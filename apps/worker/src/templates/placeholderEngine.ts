import type { PlaceholderValidationResult, PlaceholderValue, TemplateManifest } from "./types.js";

const PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

export const normalizePlaceholderValue = (value: PlaceholderValue): string => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

export const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const extractPlaceholders = (input: string): string[] =>
  Array.from(input.matchAll(PLACEHOLDER_PATTERN), (match) => match[1] ?? "").filter(Boolean);

export const replacePlaceholders = (
  input: string,
  values: Record<string, PlaceholderValue>,
  rawKeys: ReadonlySet<string> = new Set()
): { output: string; replacedCount: number; unreplaced: string[] } => {
  let replacedCount = 0;
  const missing = new Set<string>();
  const output = input.replace(PLACEHOLDER_PATTERN, (token, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      missing.add(key);
      return token;
    }
    replacedCount += 1;
    const normalized = normalizePlaceholderValue(values[key]);
    return rawKeys.has(key) ? normalized : escapeHtml(normalized);
  });

  return {
    output,
    replacedCount,
    unreplaced: Array.from(new Set([...missing, ...extractPlaceholders(output)]))
  };
};

export const validatePlaceholderValues = (
  manifest: TemplateManifest,
  values: Record<string, PlaceholderValue>,
  renderedHtml: string[]
): PlaceholderValidationResult => {
  const manifestKeys = new Set(manifest.placeholders.map((placeholder) => placeholder.key));
  const missingRequired = manifest.placeholders
    .filter((placeholder) => placeholder.required && !normalizePlaceholderValue(values[placeholder.key]).trim())
    .map((placeholder) => placeholder.key);
  const unusedProvided = Object.keys(values).filter((key) => !manifestKeys.has(key));
  const unreplacedInOutput = Array.from(new Set(renderedHtml.flatMap(extractPlaceholders)));

  return {
    valid: missingRequired.length === 0 && unreplacedInOutput.length === 0,
    missingRequired,
    unusedProvided,
    unreplacedInOutput
  };
};
