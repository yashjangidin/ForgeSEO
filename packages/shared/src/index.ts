export const COLLECTIONS = {
  users: "users",
  projects: "projects",
  generationJobs: "generationJobs",
  pages: "pages",
  assets: "assets",
  activities: "activities",
  templates: "templates",
  deployments: "deployments",
  settings: "settings"
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export type GenerationStatus =
  | "queued"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type EngineStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export const ENGINE_ORDER = [
  "structured-json-generator",
  "template-renderer",
  "preview-builder",
  "zip-export"
] as const;

export type GenerationEngine = (typeof ENGINE_ORDER)[number];

export interface AnchorLink {
  text: string;
  url: string;
}

export type SocialPlatform =
  | "linkedin"
  | "instagram"
  | "x"
  | "facebook"
  | "youtube";

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface ServiceKeywordGroup {
  keywords: string[];
}

export type ContactMode =
  | "form-map"
  | "form"
  | "details-map"
  | "details";

export type AiProvider =
  | "openai"
  | "gemini"
  | "anthropic"
  | "openrouter"
  | "perplexity"
  | "xai"
  | "groq"
  | "mistral"
  | "together";

export const serviceKeywordToFileName = (input: string): string => {
  const slug = input
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${slug || "service"}.html`;
};

export interface WizardConfig {
  templateId?: string;
  templateIds?: string[];
  pageCount?: number;
  businessName: string;
  businessDescription: string;
  industry: string;
  customLogoEnabled?: boolean;
  logoDataUrl?: string;
  logoFileName?: string;
  homePageKeywords?: string[];
  homeImageCount?: number;
  serviceImageCount?: number;
  location?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  contactHours?: string;
  contactMode?: ContactMode;
  mapEmbedCode?: string;
  contactMapEmbedCode?: string;
  websiteUrl?: string;
  dropdownLabel?: string;
  serviceKeywords?: string[];
  serviceKeywordGroups?: ServiceKeywordGroup[];
  youtubeEmbedCode?: string;
  googleDocsEmbedCode?: string;
  googlePresentationEmbedCode?: string;
  googleSheetsEmbedCode?: string;
  socialLinks?: SocialLink[];
  anchorLinks?: AnchorLink[];
  anchorText?: string;
  anchorUrl?: string;
  selectedPages?: WebsitePageKind[];
}

export type ProjectWizardConfig = WizardConfig;

export interface TemplateSummary {
  id: string;
  name: string;
  industry: string;
  style: string;
  colorPalette: string[];
  pages: WebsitePageKind[];
  placeholderCount: number;
  previewImageUrl?: string;
}

export type WebsitePageKind =
  | "home"
  | "about"
  | "services"
  | "landing"
  | "blog"
  | "faq"
  | "contact";

export interface Project {
  id: string;
  userId: string;
  name: string;
  wizardConfig: WizardConfig;
  createdAt: string;
  updatedAt: string;
  lastGenerationJobId?: string;
}

export interface JobLogEntry {
  timestamp: string;
  engine: GenerationEngine | "system";
  level: "info" | "warning" | "error";
  message: string;
}

export interface EngineCheckpoint {
  engine: GenerationEngine;
  status: EngineStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface GenerationJob {
  id: string;
  projectId: string;
  userId: string;
  status: GenerationStatus;
  progress: number;
  currentEngine?: GenerationEngine;
  currentTask: string;
  completedEngines: GenerationEngine[];
  failedEngines: GenerationEngine[];
  estimatedTimeSeconds?: number;
  startedAt?: string;
  elapsedSeconds: number;
  createdAt: string;
  updatedAt: string;
  logs: JobLogEntry[];
  errors: string[];
  checkpoints: EngineCheckpoint[];
  result?: GenerationResult;
}

export interface GenerationResult {
  previewUrl: string;
  zipUrl: string;
  storagePrefix: string;
  pageCount: number;
  assetCount: number;
  completedAt: string;
}

export interface GeneratedPage {
  id: string;
  projectId: string;
  jobId: string;
  slug: string;
  kind: WebsitePageKind;
  title: string;
  metaDescription: string;
  headings: string[];
  html: string;
  wordCount: number;
  status: "rendered" | "edited" | "needs-review";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedAsset {
  id: string;
  projectId: string;
  jobId: string;
  type: "image" | "icon" | "download" | "zip" | "manifest" | "sitemap" | "robots";
  path: string;
  url: string;
  alt?: string;
  createdAt: string;
}

export interface StartGenerationRequest {
  projectId?: string;
  wizardConfig: ProjectWizardConfig;
  aiProvider?: AiProvider;
  aiApiKey?: string;
  aiModel?: string;
  openAiApiKey?: string;
  openAiModel?: string;
}

export interface StartGenerationResponse {
  projectId: string;
  jobId: string;
  status: GenerationStatus;
}

export interface CapabilityState {
  firebaseAdmin: boolean;
  redis: boolean;
  generationMode?: "queue" | "direct";
  structuredJson: boolean;
  openai?: boolean;
  storage: boolean;
  generationEnabled: boolean;
  disabledReason?: string;
}
