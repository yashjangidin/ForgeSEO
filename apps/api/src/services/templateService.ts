import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { TemplateSummary } from "@forgeseo/shared";

interface TemplateManifest {
  id: string;
  name: string;
  industry: string;
  style: string;
  colorPalette: string[];
  sourceRoot?: string;
  supportedPages: Array<{ kind: TemplateSummary["pages"][number]; source: string; output: string }>;
  placeholders: Array<{ key: string }>;
  previewImage?: string;
}

const MANIFEST_FILE = "template.manifest.json";

const findRepositoryRoot = (): string => {
  let current = process.cwd();
  while (true) {
    if (existsSync(path.join(current, "templates"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
};

export class TemplateService {
  private readonly templatesRoot = path.join(findRepositoryRoot(), "templates");

  async listTemplates(): Promise<TemplateSummary[]> {
    const entries = await readdir(this.templatesRoot, { withFileTypes: true }).catch(() => []);
    const templates: TemplateSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const manifestPath = path.join(this.templatesRoot, entry.name, MANIFEST_FILE);
      const manifest = await readFile(manifestPath, "utf8")
        .then((content) => JSON.parse(content.replace(/^\uFEFF/, "")) as TemplateManifest)
        .catch(() => undefined);
      if (!manifest) {
        continue;
      }
      templates.push({
        id: manifest.id,
        name: manifest.name,
        industry: manifest.industry,
        style: manifest.style,
        colorPalette: manifest.colorPalette,
        pages: manifest.supportedPages.map((page) => page.kind),
        placeholderCount: manifest.placeholders.length,
        previewImageUrl: manifest.previewImage ? `/api/templates/${manifest.id}/preview` : undefined
      });
    }

    return templates.sort((left, right) => left.name.localeCompare(right.name));
  }

  async loadPreview(templateId: string): Promise<{ content: Buffer; contentType: string } | undefined> {
    const templateDirectory = path.join(this.templatesRoot, templateId);
    const manifest = await readFile(path.join(templateDirectory, MANIFEST_FILE), "utf8")
      .then((content) => JSON.parse(content.replace(/^\uFEFF/, "")) as TemplateManifest)
      .catch(() => undefined);
    if (!manifest?.previewImage) {
      return undefined;
    }
    const sourceRoot = path.join(templateDirectory, manifest.sourceRoot ?? "");
    const previewPath = path.join(sourceRoot, manifest.previewImage);
    const content = await readFile(previewPath).catch(() => undefined);
    if (!content) {
      return undefined;
    }

    return {
      content,
      contentType: this.contentTypeFor(previewPath)
    };
  }

  private contentTypeFor(filePath: string): string {
    switch (path.extname(filePath).toLowerCase()) {
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".webp":
        return "image/webp";
      case ".svg":
        return "image/svg+xml";
      default:
        return "application/octet-stream";
    }
  }
}
