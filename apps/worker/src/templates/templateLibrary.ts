import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SelectedTemplate, TemplateManifest } from "./types.js";

const MANIFEST_FILE = "template.manifest.json";
const REGISTRY_FILE = path.join("templates", "registry.json");

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

const findRepositoryRootFrom = async (start: string): Promise<string | undefined> => {
  let current = path.resolve(start);
  while (true) {
    if (await pathExists(path.join(current, REGISTRY_FILE))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
};

const findRepositoryRoot = async (): Promise<string> => {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  return (await findRepositoryRootFrom(process.cwd())) ?? (await findRepositoryRootFrom(moduleDirectory)) ?? process.cwd();
};

export class TemplateLibrary {
  constructor(private readonly templatesRoot?: string) {}

  async listTemplates(): Promise<SelectedTemplate[]> {
    const root = await this.resolveTemplatesRoot();
    if (!(await pathExists(root))) {
      return [];
    }

    const entries = await readdir(root, { withFileTypes: true });
    const templates: SelectedTemplate[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const templateDirectory = path.join(root, entry.name);
      const manifestPath = path.join(templateDirectory, MANIFEST_FILE);
      if (!(await pathExists(manifestPath))) {
        continue;
      }
      const manifestSource = (await readFile(manifestPath, "utf8")).replace(/^\uFEFF/, "");
      const manifest = JSON.parse(manifestSource) as TemplateManifest;
      await this.assertTemplateFiles(templateDirectory, manifest);
      templates.push({ manifest, rootDirectory: templateDirectory });
    }
    return templates.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
  }

  async selectTemplate(templateId?: string, industry?: string): Promise<SelectedTemplate> {
    const templates = await this.listTemplates();
    if (templates.length === 0) {
      throw new Error("No website templates are registered.");
    }

    if (templateId) {
      const exact = templates.find((template) => template.manifest.id === templateId);
      if (!exact) {
        throw new Error(`Template "${templateId}" is not registered.`);
      }
      return exact;
    }

    const normalizedIndustry = industry?.trim().toLowerCase();
    const industryMatch = normalizedIndustry
      ? templates.find((template) => template.manifest.industry.toLowerCase() === normalizedIndustry)
      : undefined;

    return industryMatch ?? templates[0]!;
  }

  private async resolveTemplatesRoot(): Promise<string> {
    if (this.templatesRoot) {
      return this.templatesRoot;
    }
    const repositoryRoot = await findRepositoryRoot();
    return path.join(repositoryRoot, "templates");
  }

  private async assertTemplateFiles(root: string, manifest: TemplateManifest): Promise<void> {
    const sourceRoot = path.join(root, manifest.sourceRoot ?? "");
    for (const page of manifest.supportedPages) {
      const source = path.join(sourceRoot, page.source);
      const sourceStat = await stat(source).catch(() => undefined);
      if (!sourceStat?.isFile()) {
        throw new Error(`Template "${manifest.id}" is missing page source: ${page.source}`);
      }
    }
  }
}
