import { z } from "zod";

const requiredText = z.string().trim().min(2).max(4000);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const logoDataUrlMaxLength = 7_000_000;
const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().email().optional()
);
const optionalUrl = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}, z.string().url().optional());
const requiredUrl = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}, z.string().url());

export const startGenerationSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  aiProvider: z.enum(["openai", "gemini", "anthropic", "openrouter", "perplexity", "xai", "groq", "mistral", "together"]).optional(),
  aiApiKey: z.string().trim().min(8).max(500).optional(),
  aiModel: z.string().trim().min(1).max(160).optional(),
  openAiApiKey: z.string().trim().min(20).max(300).optional(),
  openAiModel: z.string().trim().min(1).max(120).optional(),
  wizardConfig: z.object({
    templateId: z.string().trim().min(1).max(120).optional(),
    templateIds: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    pageCount: z.coerce.number().int().min(1).max(50).optional(),
    businessName: requiredText.max(120),
    businessDescription: requiredText,
    industry: requiredText.max(120),
    customLogoEnabled: z.boolean().optional(),
    logoDataUrl: z.string().trim().regex(/^data:image\/(?:png|svg\+xml);base64,[A-Za-z0-9+/=]+$/).max(logoDataUrlMaxLength).optional(),
    logoFileName: optionalText(180),
    homePageKeywords: z.array(z.string().trim().min(1).max(180)).min(1).max(50).optional(),
    homeImageCount: z.coerce.number().int().min(0).max(20).optional(),
    serviceImageCount: z.coerce.number().int().min(0).max(20).optional(),
    location: z.string().trim().max(180).optional(),
    contactEmail: optionalEmail,
    contactPhone: z.string().trim().min(6).max(30).optional(),
    contactAddress: optionalText(300),
    contactHours: optionalText(300),
    contactMode: z.enum(["form-map", "form", "details-map", "details"]).optional(),
    mapEmbedCode: optionalText(5000),
    contactMapEmbedCode: optionalText(5000),
    websiteUrl: optionalUrl,
    dropdownLabel: optionalText(120),
    serviceKeywords: z.array(z.string().trim().min(1).max(180)).min(1).max(20).optional(),
    serviceKeywordGroups: z.array(z.object({
      keywords: z.array(z.string().trim().min(1).max(180)).min(1).max(10)
    })).min(1).max(50).optional(),
    youtubeEmbedCode: optionalText(5000),
    googleDocsEmbedCode: optionalText(5000),
    googlePresentationEmbedCode: optionalText(5000),
    googleSheetsEmbedCode: optionalText(5000),
    socialLinks: z.array(z.object({
      platform: z.enum(["linkedin", "instagram", "x", "facebook", "youtube"]),
      url: requiredUrl
    })).max(5).optional(),
    anchorLinks: z.array(z.object({
      text: z.string().trim().min(1).max(180),
      url: requiredUrl
    })).max(20).optional(),
    anchorText: optionalText(180),
    anchorUrl: optionalUrl,
    selectedPages: z.array(z.enum(["home", "about", "services", "contact"])).max(4).optional()
  })
});
