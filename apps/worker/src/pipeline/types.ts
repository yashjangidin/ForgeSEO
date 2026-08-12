import type { GeneratedAsset, GeneratedPage, GenerationEngine, Project, WizardConfig } from "@forgeseo/shared";
import type { SelectedTemplate, TemplateRenderReport } from "../templates/types.js";
import type { TemplateContent } from "../templates/templateContent.js";

export interface BuildArtifact {
  relativePath: string;
  content: string | Buffer;
  contentType: string;
}

export interface GeneratedImageAsset {
  fileName: string;
  relativePath: string;
  content: Buffer;
  contentType: string;
  alt: string;
}

export interface GenerationState {
  project: Project;
  wizardConfig: WizardConfig;
  templateContent?: TemplateContent;
  generatedImages?: GeneratedImageAsset[];
  placeholderValues?: Record<string, string | number | boolean | null | undefined>;
  selectedTemplate?: SelectedTemplate;
  selectedTemplates?: SelectedTemplate[];
  renderingReport?: TemplateRenderReport;
  pages: GeneratedPage[];
  assets: GeneratedAsset[];
  artifacts: BuildArtifact[];
  zipPath?: string;
  previewUrl?: string;
  zipUrl?: string;
}

export interface EngineResult {
  task: string;
  state: GenerationState;
}

export interface GenerationEngineRunner {
  name: GenerationEngine;
  run(state: GenerationState): Promise<EngineResult>;
}
