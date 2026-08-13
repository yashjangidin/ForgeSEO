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
  | "waiting-for-images"
  | "completed"
  | "failed"
  | "cancelled";

export type EngineStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export const ENGINE_ORDER = [
  "structured-json-generator",
  "image-generator",
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

export type ImageSourceMode =
  | "forge"
  | "prompt-upload"
  | "url";

export type ImageRequirementKind = "home" | "service";

export interface ImageRequirement {
  id: string;
  kind: ImageRequirementKind;
  pageIndex: number;
  imageIndex: number;
  label: string;
  prompt: string;
  status: "pending" | "uploaded" | "resolved";
  serviceKeywordIndex?: number;
  serviceKeyword?: string;
  fileName?: string;
  sourceUrl?: string;
}

export interface UserImageInput {
  requirementId: string;
  dataUrl?: string;
  url?: string;
  fileName?: string;
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
  imageSourceMode?: ImageSourceMode;
  imageUrls?: Array<{
    requirementId: string;
    url: string;
  }>;
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

const uniqueRequirementKeywords = (items: Array<string | undefined>): string[] =>
  items.reduce<string[]>((values, item) => {
    const normalized = item?.trim();
    if (!normalized || values.some((value) => value.toLowerCase() === normalized.toLowerCase())) {
      return values;
    }
    values.push(normalized);
    return values;
  }, []);

const requirementSlug = (input: string): string =>
  input
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "image";

const imagePromptForRequirement = (
  config: Pick<WizardConfig, "businessName" | "businessDescription" | "industry" | "location" | "homePageKeywords">,
  label: string,
  variation: number,
  keyword?: string
): string => [
  `Create a professional website image for ${config.businessName}.`,
  `Image purpose: ${label}.`,
  keyword ? `Primary keyword: ${keyword}.` : undefined,
  `Industry: ${config.industry}.`,
  config.location ? `Location/context: ${config.location}.` : undefined,
  config.homePageKeywords?.length ? `Content themes: ${config.homePageKeywords.join(", ")}.` : undefined,
  `Business context: ${config.businessDescription}`,
  "Style: polished editorial website asset, realistic or premium digital composition, clean lighting, high detail, no text, no watermarks, no logos.",
  `Variation ${variation}: make this image distinct from the other required website images.`
].filter(Boolean).join("\n");

export const buildImageRequirements = (config: WizardConfig): ImageRequirement[] => {
  const pageCount = Math.max(1, Math.min(50, config.pageCount ?? 1));
  const homeImageCount = Math.max(0, Math.min(20, config.homeImageCount ?? 0));
  const selectedPages = new Set<WebsitePageKind>(config.selectedPages?.length ? config.selectedPages : ["home", "about", "services", "contact"]);
  const requirements: ImageRequirement[] = [];
  let variation = 1;

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    for (let imageIndex = 0; imageIndex < homeImageCount; imageIndex += 1) {
      const label = `Home page ${pageIndex + 1}, image ${imageIndex + 1}`;
      requirements.push({
        id: `home-${pageIndex + 1}-${imageIndex + 1}`,
        kind: "home",
        pageIndex,
        imageIndex,
        label,
        prompt: imagePromptForRequirement(config, label, variation, config.homePageKeywords?.[pageIndex % (config.homePageKeywords.length || 1)]),
        status: "pending"
      });
      variation += 1;
    }
  }

  if (selectedPages.has("services")) {
    const groups = Array.from({ length: pageCount }, (_, index) => {
      const configuredGroup = config.serviceKeywordGroups?.[index]?.keywords ?? [];
      const legacyKeyword = config.serviceKeywords?.[index] ?? (index === 0 ? config.dropdownLabel : undefined);
      const keywords = uniqueRequirementKeywords([...configuredGroup, legacyKeyword]);
      return keywords.length ? keywords : [config.industry];
    });

    for (const [pageIndex, group] of groups.entries()) {
      for (const [keywordIndex, keyword] of group.entries()) {
        const label = `Service page "${keyword}"`;
        requirements.push({
          id: `service-${pageIndex + 1}-${keywordIndex + 1}-${requirementSlug(keyword)}`,
          kind: "service",
          pageIndex,
          serviceKeywordIndex: keywordIndex,
          imageIndex: 0,
          label,
          prompt: imagePromptForRequirement(config, label, variation, keyword),
          status: "pending",
          serviceKeyword: keyword
        });
        variation += 1;
      }
    }
  }

  return requirements;
};

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
  imageSourceMode?: ImageSourceMode;
  imageRequirements?: ImageRequirement[];
  templateContentSnapshot?: unknown;
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

export interface ContinueGenerationRequest {
  imageInputs: UserImageInput[];
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
  runtime?: {
    commitSha?: string;
    deploymentId?: string;
    environment?: string;
  };
}
