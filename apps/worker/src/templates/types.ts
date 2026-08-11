import type { WebsitePageKind } from "@forgeseo/shared";
import type { BuildArtifact } from "../pipeline/types.js";

export type PlaceholderValue = string | number | boolean | null | undefined;

export interface TemplatePlaceholder {
  key: string;
  required?: boolean;
  raw?: boolean;
  description?: string;
}

export interface TemplatePage {
  kind: WebsitePageKind;
  source: string;
  output: string;
}

export interface TemplateManifest {
  id: string;
  name: string;
  industry: string;
  style: string;
  colorPalette: string[];
  sourceRoot?: string;
  supportedPages: TemplatePage[];
  placeholders: TemplatePlaceholder[];
  previewImage?: string;
}

export interface SelectedTemplate {
  manifest: TemplateManifest;
  rootDirectory: string;
}

export interface PlaceholderValidationResult {
  valid: boolean;
  missingRequired: string[];
  unusedProvided: string[];
  unreplacedInOutput: string[];
}

export interface TemplateRenderReport {
  templateId: string;
  templateName: string;
  renderedPages: string[];
  copiedAssets: string[];
  replacedPlaceholderCount: number;
  missingRequiredPlaceholders: string[];
  unreplacedPlaceholders: string[];
  durationMs: number;
}

export interface TemplateRenderResult {
  artifacts: BuildArtifact[];
  report: TemplateRenderReport;
}
