import path from "node:path";
import { buildImageRequirements, type ImageRequirement, type UserImageInput, type WizardConfig } from "@forgeseo/shared";
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

const safeImageName = (input: string): string =>
  input
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 70) || "image";

const extensionFromContentType = (contentType: string): string => {
  if (/jpe?g/i.test(contentType)) {
    return "jpg";
  }
  if (/webp/i.test(contentType)) {
    return "webp";
  }
  if (/svg/i.test(contentType)) {
    return "svg";
  }
  return "png";
};

const extensionFromFileName = (fileName: string | undefined, fallback = "png"): string => {
  const extension = path.extname(fileName ?? "").replace(".", "").toLowerCase();
  return ["png", "jpg", "jpeg", "webp", "svg"].includes(extension) ? (extension === "jpeg" ? "jpg" : extension) : fallback;
};

const contentTypeFromExtension = (extension: string): string => {
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  if (extension === "webp") {
    return "image/webp";
  }
  if (extension === "svg") {
    return "image/svg+xml";
  }
  return "image/png";
};

const dataUrlToImage = (dataUrl: string): { content: Buffer; contentType: string; extension: string } => {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
  if (!match?.[1] || !match[2]) {
    throw new Error("Uploaded image must be a PNG, JPG, WebP, or SVG data URL.");
  }
  const contentType = match[1].replace("image/jpg", "image/jpeg");
  return {
    content: Buffer.from(match[2], "base64"),
    contentType,
    extension: extensionFromContentType(contentType)
  };
};

const assetFromRequirement = (
  requirement: ImageRequirement,
  content: Buffer,
  contentType: string,
  extension: string
): GeneratedImageAsset => {
  const fileName = `${safeImageName(requirement.id)}.${extension}`;
  return {
    requirementId: requirement.id,
    kind: requirement.kind,
    pageIndex: requirement.pageIndex,
    imageIndex: requirement.imageIndex,
    serviceKeyword: requirement.serviceKeyword,
    fileName,
    relativePath: `Extra/generated-images/${fileName}`,
    content,
    contentType,
    alt: requirement.label,
    prompt: requirement.prompt
  };
};

export class ImageGenerationService {
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    const resolvedKey = options.apiKey?.trim() || workerConfig.openAiApiKey;
    this.apiKey = resolvedKey;
    this.model = options.model?.trim() || defaultImageModel;
  }

  async generateWebsiteImages(config: WizardConfig, requirements = buildImageRequirements(config)): Promise<GeneratedImageAsset[]> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is required for ForgeSEO image generation.");
    }
    const images: GeneratedImageAsset[] = [];
    for (const requirement of requirements) {
      const response = await fetch(imageEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          prompt: requirement.prompt,
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

      images.push(assetFromRequirement(requirement, Buffer.from(base64, "base64"), "image/png", "png"));
    }

    return images;
  }

  async resolveUrlImages(config: WizardConfig, requirements = buildImageRequirements(config)): Promise<GeneratedImageAsset[]> {
    const urlMap = new Map((config.imageUrls ?? []).map((item) => [item.requirementId, item.url.trim()]));
    const missing = requirements.filter((requirement) => !urlMap.get(requirement.id));
    if (missing.length > 0) {
      throw new Error(`Image URLs are missing for: ${missing.map((item) => item.label).join(", ")}.`);
    }

    const images: GeneratedImageAsset[] = [];
    for (const requirement of requirements) {
      const url = urlMap.get(requirement.id)!;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not fetch image URL for ${requirement.label}: HTTP ${response.status}.`);
      }
      const contentType = response.headers.get("content-type") ?? "image/png";
      if (!contentType.startsWith("image/")) {
        throw new Error(`URL for ${requirement.label} did not return an image.`);
      }
      const extension = extensionFromContentType(contentType);
      images.push(assetFromRequirement(requirement, Buffer.from(await response.arrayBuffer()), contentType, extension));
    }
    return images;
  }

  static uploadedImagesFromInputs(requirements: ImageRequirement[], inputs: UserImageInput[]): GeneratedImageAsset[] {
    const inputMap = new Map(inputs.map((input) => [input.requirementId, input]));
    return requirements.map((requirement) => {
      const input = inputMap.get(requirement.id);
      if (!input?.dataUrl) {
        throw new Error(`Upload an image for ${requirement.label}.`);
      }
      const parsed = dataUrlToImage(input.dataUrl);
      const extension = extensionFromFileName(input.fileName, parsed.extension);
      return assetFromRequirement(requirement, parsed.content, contentTypeFromExtension(extension), extension);
    });
  }
}
