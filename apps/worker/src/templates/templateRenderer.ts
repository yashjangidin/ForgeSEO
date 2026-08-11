import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { replacePlaceholders, validatePlaceholderValues } from "./placeholderEngine.js";
import type { PlaceholderValue, SelectedTemplate, TemplateRenderResult } from "./types.js";

const contentTypeFor = (relativePath: string): string => {
  const extension = path.extname(relativePath).toLowerCase();
  switch (extension) {
    case ".html":
      return "text/html";
    case ".css":
      return "text/css";
    case ".js":
      return "text/javascript";
    case ".json":
      return "application/json";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
};

const toPosixPath = (input: string): string => input.split(path.sep).join("/");

const listFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
};

export class TemplateRenderer {
  async render(
    template: SelectedTemplate,
    values: Record<string, PlaceholderValue>,
    pageValuesByOutput: Record<string, Record<string, PlaceholderValue>> = {}
  ): Promise<TemplateRenderResult> {
    const started = performance.now();
    const sourceRoot = path.join(template.rootDirectory, template.manifest.sourceRoot ?? "");
    const htmlSources = new Set(template.manifest.supportedPages.map((page) => path.normalize(page.source)));
    const rawKeys = new Set(template.manifest.placeholders.filter((placeholder) => placeholder.raw).map((placeholder) => placeholder.key));
    const artifacts = [];
    const renderedHtml: string[] = [];
    const renderedPages: string[] = [];
    const copiedAssets: string[] = [];
    let replacedPlaceholderCount = 0;

    for (const page of template.manifest.supportedPages) {
      const sourcePath = path.join(sourceRoot, page.source);
      const source = await readFile(sourcePath, "utf8");
      const pageValues = { ...values, ...(pageValuesByOutput[page.output] ?? {}) };
      const rendered = replacePlaceholders(source, pageValues, rawKeys);
      replacedPlaceholderCount += rendered.replacedCount;
      renderedHtml.push(rendered.output);
      renderedPages.push(page.output);
      artifacts.push({
        relativePath: page.output,
        content: rendered.output,
        contentType: "text/html"
      });
    }

    const allFiles = await listFiles(sourceRoot);
    for (const file of allFiles) {
      const relative = path.relative(sourceRoot, file);
      if (htmlSources.has(path.normalize(relative)) || path.extname(relative).toLowerCase() === ".html") {
        continue;
      }
      const content = await readFile(file);
      const outputPath = toPosixPath(relative);
      copiedAssets.push(outputPath);
      artifacts.push({
        relativePath: outputPath,
        content,
        contentType: contentTypeFor(outputPath)
      });
    }

    const validation = validatePlaceholderValues(template.manifest, values, renderedHtml);
    const durationMs = Math.round(performance.now() - started);

    return {
      artifacts,
      report: {
        templateId: template.manifest.id,
        templateName: template.manifest.name,
        renderedPages,
        copiedAssets,
        replacedPlaceholderCount,
        missingRequiredPlaceholders: validation.missingRequired,
        unreplacedPlaceholders: validation.unreplacedInOutput,
        durationMs
      }
    };
  }
}
