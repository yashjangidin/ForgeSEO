import type { WizardConfig } from "@forgeseo/shared";
import { workerConfig } from "../config.js";
import type { GeneratedImageAsset } from "../pipeline/types.js";

interface OpenAiImageResponse {
  data?: Array<{
    b64_json?: string;
  }>;
  error?: {
    message?: string;
  };
}

const imageEndpoint = "https://api.openai.com/v1/images/generations";
const defaultImageModel = "gpt-image-1";

const imageCountFor = (config: WizardConfig): number =>
  Math.max(0, Math.min(10, Math.max(config.homeImageCount ?? 0, config.serviceImageCount ?? 0)));

const keywordsFor = (config: WizardConfig): string[] => [
  ...(config.homePageKeywords ?? []),
  ...(config.serviceKeywordGroups ?? []).flatMap((group) => group.keywords),
  ...(config.serviceKeywords ?? []),
  config.industry,
  config.location,
  config.businessName
].filter((value): value is string => Boolean(value?.trim()));

const imagePromptFor = (config: WizardConfig, index: number): string => {
  const keywords = keywordsFor(config).slice(0, 10).join(", ");
  return [
    `Create a professional website image for ${config.businessName}.`,
    `Industry: ${config.industry}.`,
    config.location ? `Location/context: ${config.location}.` : undefined,
    keywords ? `Use these content themes: ${keywords}.` : undefined,
    "Style: polished editorial website asset, realistic or premium digital composition, clean lighting, high detail, no text, no watermarks, no logos, no UI mockup text.",
    `Variation ${index + 1}: make it visually distinct while still matching the same brand website.`
  ].filter(Boolean).join("\n");
};

export class ImageGenerationService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    const resolvedKey = options.apiKey?.trim() || workerConfig.openAiApiKey;
    if (!resolvedKey) {
      throw new Error("OpenAI API key is required for image generation.");
    }
    this.apiKey = resolvedKey;
    this.model = options.model?.trim() || defaultImageModel;
  }

  async generateWebsiteImages(config: WizardConfig): Promise<GeneratedImageAsset[]> {
    const count = imageCountFor(config);
    if (count === 0) {
      return [];
    }

    const images: GeneratedImageAsset[] = [];
    for (let index = 0; index < count; index += 1) {
      const prompt = imagePromptFor(config, index);
      const response = await fetch(imageEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          size: "1024x1024",
          quality: "low",
          n: 1
        })
      });

      const body = (await response.json().catch(() => ({}))) as OpenAiImageResponse;
      if (!response.ok) {
        throw new Error(body.error?.message ?? `OpenAI image generation failed with status ${response.status}.`);
      }

      const base64 = body.data?.[0]?.b64_json;
      if (!base64) {
        throw new Error("OpenAI image generation returned no image data.");
      }

      const fileName = `generated-image-${index + 1}.png`;
      images.push({
        fileName,
        relativePath: `Extra/generated-images/${fileName}`,
        content: Buffer.from(base64, "base64"),
        contentType: "image/png",
        alt: `${config.businessName} generated website image ${index + 1}`
      });
    }

    return images;
  }
}
