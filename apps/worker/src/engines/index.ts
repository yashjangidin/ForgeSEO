import crypto from "node:crypto";
import path from "node:path";
import { buildImageRequirements, serviceKeywordToFileName, type AnchorLink, type GeneratedAsset, type GeneratedPage, type ImageRequirement, type WebsitePageKind, type WizardConfig } from "@forgeseo/shared";
import { workerConfig } from "../config.js";
import type { BuildArtifact, GeneratedImageAsset, GenerationEngineRunner, GenerationState } from "../pipeline/types.js";
import { TemplateLibrary } from "../templates/templateLibrary.js";
import { TemplateRenderer } from "../templates/templateRenderer.js";
import { createFallbackTemplateContent, flattenTemplateContent, structuredAboutContentToHtml, structuredHomeContentToHtml, structuredServiceContentToHtml, type RenderImageOptions, type TemplateContent } from "../templates/templateContent.js";
import type { PlaceholderValue, SelectedTemplate, TemplatePage, TemplateRenderReport } from "../templates/types.js";
import { countWords, pageId, slugify } from "./engineUtils.js";
import { ImageGenerationService } from "../services/imageGenerationService.js";

interface StructuredJsonService {
  generateJson<T>(prompt: string, options?: { maxOutputTokens?: number }): Promise<T>;
  describe?(): string;
}

interface WebsiteImageService {
  generateWebsiteImages(config: WizardConfig, requirements: ImageRequirement[]): Promise<GeneratedImageAsset[]>;
  resolveUrlImages(config: WizardConfig, requirements: ImageRequirement[]): Promise<GeneratedImageAsset[]>;
}

const stripHtml = (input: string): string =>
  input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripGeneratedArticleImages = (html: string): string =>
  html.replace(/\s*<div\s+class=["'][^"']*\barticle-image\b[^"']*["'][^>]*>\s*<img\b[^>]*>\s*<\/div>/gi, "");

const titleFromRenderedHtml = (html: string, fallback: string): string => html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || fallback;

const descriptionFromRenderedHtml = (html: string, fallback: string): string =>
  html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim() || fallback;

const headingsFromRenderedHtml = (html: string): string[] =>
  Array.from(html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi), (match) => stripHtml(match[1] ?? "")).filter(Boolean);

const slugFromOutputPath = (output: string): string => {
  const normalized = output.replace(/\\/g, "/");
  if (normalized === "index.html") {
    return "index";
  }
  return slugify(normalized.replace(/\/index\.html$/i, "").replace(/\.html$/i, "")) || "index";
};

const toPosix = (input: string): string => input.replace(/\\/g, "/");

const prefixArtifacts = (artifacts: BuildArtifact[], prefix: string): BuildArtifact[] =>
  artifacts.map((artifact) => ({
    ...artifact,
    relativePath: toPosix(path.posix.join(prefix, artifact.relativePath))
  }));

const pageKindFor = (template: SelectedTemplate, outputPath: string): WebsitePageKind =>
  template.manifest.supportedPages.find((page) => toPosix(outputPath).endsWith(toPosix(page.output)))?.kind ?? "landing";

const uniqueServiceFileName = (keyword: string, used: Set<string>): string => {
  const fileName = serviceKeywordToFileName(keyword);
  if (!used.has(fileName.toLowerCase())) {
    used.add(fileName.toLowerCase());
    return fileName;
  }
  const extension = ".html";
  const base = fileName.endsWith(extension) ? fileName.slice(0, -extension.length) : fileName;
  let index = 2;
  while (used.has(`${base}-${index}${extension}`.toLowerCase())) {
    index += 1;
  }
  const unique = `${base}-${index}${extension}`;
  used.add(unique.toLowerCase());
  return unique;
};

const structuredJsonTokenBudgetFor = (config: WizardConfig): number => {
  const pageCount = Math.max(1, Math.min(50, config.pageCount ?? 1));
  const servicePageCount = config.serviceKeywordGroups?.reduce((count, group) => count + group.keywords.filter(Boolean).length, 0) ?? config.serviceKeywords?.length ?? pageCount;
  return Math.min(24_000, Math.max(8_000, 6_000 + pageCount * 900 + servicePageCount * 550));
};

const structuredContentContract = `{
  "businessName": "string",
  "tagline": "string",
  "logoMarkup": "string",
  "dropdownLabel": "string",
  "serviceKeywords": ["string"],
  "youtubeEmbedCode": "string",
  "googleDocsEmbedCode": "string",
  "googlePresentationEmbedCode": "string",
  "googleSheetsEmbedCode": "string",
  "mapEmbedCode": "string",
  "contactMapEmbedCode": "string",
  "hero": { "title": "string", "description": ["string", "string"], "cta": "string" },
  "about": { "title": "string", "description": ["8 or 9 paragraph strings"] },
  "services": [{ "title": "string", "description": "string" }],
  "features": [{ "title": "string", "description": "string" }],
  "testimonials": [{ "quote": "string", "name": "string", "role": "string" }],
  "faq": [{ "question": "string", "answer": "string" }],
  "contact": { "email": "string", "phone": "string", "address": "string", "hours": "string" },
  "seo": { "title": "string", "description": "string", "canonicalUrl": "string", "schema": "string" },
  "homePages": [{ "title": "string", "intro": "string", "sections": [{ "heading": "string", "body": "string" }] }],
  "servicePages": [{ "keyword": "string", "keywords": ["string"], "title": "string", "intro": "string", "sections": [{ "heading": "string", "body": "string" }] }],
  "pageContent": { "home": "", "services": "", "about": "", "contact": "" }
}`;

const templateWithSelectedPages = (
  template: SelectedTemplate,
  selectedPages: Set<WebsitePageKind>,
  serviceKeywords: string[]
): SelectedTemplate => {
  const usedServiceOutputs = new Set<string>();
  const supportedPages = template.manifest.supportedPages.reduce<TemplatePage[]>((pages, page) => {
    if (!selectedPages.has(page.kind)) {
      return pages;
    }
    if (page.kind !== "services") {
      pages.push(page);
      return pages;
    }
    for (const keyword of serviceKeywords) {
      pages.push({
        ...page,
        output: uniqueServiceFileName(keyword, usedServiceOutputs)
      });
    }
    return pages;
  }, []);

  return {
    ...template,
    manifest: {
      ...template.manifest,
      supportedPages
    }
  };
};

const selectedPageKinds = (config: WizardConfig): Set<WebsitePageKind> => {
  const configured: WebsitePageKind[] = config.selectedPages?.length ? config.selectedPages : ["home", "about", "services", "contact"];
  return new Set<WebsitePageKind>(["home", ...configured]);
};

const removePageLinks = (html: string, selectedPages: Set<WebsitePageKind>): string => {
  let output = html;
  if (!selectedPages.has("services")) {
    output = output.replace(/\s*<li\s+class=["']dropdown["'][\s\S]*?<\/li>/gi, "");
    output = output.replace(/\s*<li>\s*<a\s+href=["']services\.html["'][^>]*>[\s\S]*?<\/a>\s*<\/li>/gi, "");
    output = output.replace(/\s*<li>\s*<a\s+href=["'][^"']+["'][^>]*>\s*Services\s*<\/a>\s*<\/li>/gi, "");
  }
  if (!selectedPages.has("about")) {
    output = output.replace(/\s*<li>\s*<a\s+href=["']about-us\.html["'][^>]*>[\s\S]*?<\/a>\s*<\/li>/gi, "");
  }
  if (!selectedPages.has("contact")) {
    output = output.replace(/\s*<li>\s*<a\s+href=["']contact-us\.html["'][^>]*>[\s\S]*?<\/a>\s*<\/li>/gi, "");
  }
  return output;
};

const sanitizeFileName = (input: string): string => {
  const sanitized = input
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "Business";
};

const normalizeAnchorLinks = (config: WizardConfig): AnchorLink[] => {
  const configuredLinks = config.anchorLinks ?? [];
  const legacyLink = config.anchorText && (config.anchorUrl || config.websiteUrl)
    ? [{ text: config.anchorText, url: config.anchorUrl || config.websiteUrl! }]
    : [];

  return [...configuredLinks, ...legacyLink].reduce<AnchorLink[]>((links, anchor) => {
    const text = anchor.text.trim();
    const url = anchor.url.trim();
    if (!text || !url || links.some((link) => link.text.toLowerCase() === text.toLowerCase() && link.url === url)) {
      return links;
    }
    links.push({ text, url });
    return links;
  }, []);
};

const uniqueNonEmpty = (items: Array<string | undefined>): string[] =>
  items.reduce<string[]>((values, item) => {
    const normalized = item?.trim();
    if (!normalized || values.some((value) => value.toLowerCase() === normalized.toLowerCase())) {
      return values;
    }
    values.push(normalized);
    return values;
  }, []);

const serviceKeywordGroupsFor = (config: WizardConfig, content: TemplateContent, pageCount: number): string[][] =>
  Array.from({ length: pageCount }, (_, index) => {
    const configuredGroup = config.serviceKeywordGroups?.[index]?.keywords ?? [];
    const legacyKeyword = config.serviceKeywords?.[index] ?? content.serviceKeywords[index] ?? (index === 0 ? config.dropdownLabel : undefined);
    const keywords = uniqueNonEmpty([...configuredGroup, legacyKeyword]);
    return keywords.length ? keywords : [content.dropdownLabel || config.industry];
  });

const exactFiveFaqs = (items: TemplateContent["faq"] | undefined, fallback: TemplateContent["faq"]): TemplateContent["faq"] => {
  const source = items?.length ? items : fallback;
  const normalized = source.slice(0, 5);
  while (normalized.length < 5) {
    normalized.push(fallback[normalized.length] ?? fallback[fallback.length - 1] ?? { question: "How can I learn more?", answer: "Use the contact page to send your enquiry." });
  }
  return normalized;
};

type StructuredSection = { heading: string; body: string };

const normalizeSections = (items: StructuredSection[] | undefined, fallback: StructuredSection[]): StructuredSection[] => {
  const source = items?.length ? items : [];
  return fallback.map((fallbackSection, index) => {
    const section = source[index];
    return {
      heading: section?.heading?.trim() || fallbackSection.heading,
      body: section?.body?.trim() || fallbackSection.body
    };
  });
};

const normalizeHomePages = (items: TemplateContent["homePages"] | undefined, fallback: TemplateContent["homePages"]): TemplateContent["homePages"] => {
  const fallbackPages = fallback ?? [];
  return fallbackPages.map((fallbackPage, index) => {
    const page = items?.[index];
    return {
      title: page?.title?.trim() || fallbackPage.title,
      intro: page?.intro?.trim() || fallbackPage.intro,
      sections: normalizeSections(page?.sections, fallbackPage.sections)
    };
  });
};

const normalizeServicePages = (items: TemplateContent["servicePages"] | undefined, fallback: TemplateContent["servicePages"]): TemplateContent["servicePages"] => {
  const fallbackPages = fallback ?? [];
  return fallbackPages.map((fallbackPage, index) => {
    const page = items?.find((item) => item.keyword?.toLowerCase() === fallbackPage.keyword.toLowerCase()) ?? items?.[index];
    return {
      keyword: page?.keyword?.trim() || fallbackPage.keyword,
      keywords: [fallbackPage.keyword],
      title: page?.title?.trim() || fallbackPage.title,
      intro: page?.intro?.trim() || fallbackPage.intro,
      sections: normalizeSections(page?.sections, fallbackPage.sections)
    };
  });
};

const normalizeAbout = (items: TemplateContent["about"] | undefined, fallback: TemplateContent["about"]): TemplateContent["about"] => {
  const descriptions = fallback.description.map((fallbackParagraph, index) => items?.description?.[index]?.trim() || fallbackParagraph);
  return {
    title: items?.title?.trim() || fallback.title,
    description: descriptions
  };
};

const escapeHtmlText = (input: string | undefined): string =>
  (input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const canonicalForPage = (config: WizardConfig, outputPath: string, fallback: string): string => {
  if (!config.websiteUrl) {
    return fallback;
  }
  try {
    return new URL(outputPath, config.websiteUrl.endsWith("/") ? config.websiteUrl : `${config.websiteUrl}/`).toString();
  } catch {
    return fallback;
  }
};

const generatedImageSource = (image: GeneratedImageAsset): string => `../../${image.relativePath}`;

const homeImageSources = (state: Pick<GenerationState, "generatedImages">, pageIndex: number): string[] =>
  (state.generatedImages ?? [])
    .filter((image) => image.kind === "home" && image.pageIndex === pageIndex)
    .sort((first, second) => first.imageIndex - second.imageIndex)
    .map(generatedImageSource);

const serviceImageSources = (state: Pick<GenerationState, "generatedImages">, pageIndex: number, keyword: string): string[] =>
  (state.generatedImages ?? [])
    .filter((image) => (
      image.kind === "service"
      && image.pageIndex === pageIndex
      && image.serviceKeyword?.toLowerCase() === keyword.toLowerCase()
    ))
    .sort((first, second) => first.imageIndex - second.imageIndex)
    .slice(0, 1)
    .map(generatedImageSource);

const servicePageContent = (config: WizardConfig, content: TemplateContent, keyword: string, imageOptions: RenderImageOptions = {}): string => {
  const structuredPage = content.servicePages?.find((page) => page.keyword.toLowerCase() === keyword.toLowerCase());
  if (structuredPage) {
    return structuredServiceContentToHtml(structuredPage, config, imageOptions);
  }

  const service = content.services.find((item) => item.title.toLowerCase() === keyword.toLowerCase());
  const description = service?.description ?? `${config.businessName} provides ${keyword.toLowerCase()} with clear information, practical guidance, and simple next steps.`;
  return `
  <section class="block">
    <h2>${escapeHtmlText(keyword)}</h2>
    <p>${escapeHtmlText(description)}</p>
  </section>
  <section class="split">
    <div class="media-card"><img src="privacy-chat.png" alt="${escapeHtmlText(keyword)}"></div>
    <div class="text-card">
      <h2>${escapeHtmlText(`How ${config.businessName} Helps`)}</h2>
      <p>${escapeHtmlText(config.businessDescription)}</p>
      <p>${escapeHtmlText(`${config.businessName} keeps this page focused on ${keyword.toLowerCase()} so visitors can understand the service and move forward quickly.`)}</p>
    </div>
  </section>
  <section class="split reverse">
    <div class="media-card"><img src="idea-exploration.png" alt="${escapeHtmlText(`${keyword} planning`)}"></div>
    <div class="text-card">
      <h2>Practical Details</h2>
      <p>${escapeHtmlText(`${keyword} is presented with clear explanations, direct contact options, and business-specific context.`)}</p>
      <p>${escapeHtmlText("Future content generation can expand this page further with keyword-specific long-form copy.")}</p>
    </div>
  </section>`;
};

const contentForRenderTarget = (config: WizardConfig, content: TemplateContent, serviceKeywords: string[], pageIndex: number, imageOptions: RenderImageOptions = {}): TemplateContent => {
  const structuredHomePage = content.homePages?.[pageIndex];
  const homeContent = structuredHomePage ? structuredHomeContentToHtml(structuredHomePage, config, imageOptions) : content.pageContent.home;
  const dropdownLabel = serviceKeywords[0] ?? content.dropdownLabel;
  const heroTitle = structuredHomePage?.title ?? content.hero.title;
  const heroIntro = structuredHomePage?.intro ?? content.hero.description[0] ?? config.businessDescription;
  return {
    ...content,
    dropdownLabel,
    serviceKeywords,
    hero: {
      ...content.hero,
      title: heroTitle,
      description: [
        heroIntro,
        content.hero.description[1] ?? `${config.businessName} helps visitors compare services and take the next step.`
      ]
    },
    pageContent: {
      ...content.pageContent,
      home: homeContent
    }
  };
};

const servicePageValues = (
  config: WizardConfig,
  content: TemplateContent,
  template: SelectedTemplate,
  serviceKeywords: string[],
  baseValues: Record<string, PlaceholderValue>,
  pageIndex: number,
  state: Pick<GenerationState, "generatedImages">
): Record<string, Record<string, PlaceholderValue>> => {
  let serviceIndex = 0;
  return template.manifest.supportedPages.reduce<Record<string, Record<string, PlaceholderValue>>>((pageValues, page) => {
    if (page.kind !== "services") {
      return pageValues;
    }
    const keyword = serviceKeywords[serviceIndex] ?? serviceKeywords[0] ?? content.dropdownLabel;
    serviceIndex += 1;
    const imageOptions: RenderImageOptions = { generatedImages: serviceImageSources(state, pageIndex, keyword) };
    const metaDescription = `${config.businessName} ${keyword}: ${config.businessDescription}`.slice(0, 155);
    pageValues[page.output] = {
      HERO_TITLE: keyword,
      HERO_DESCRIPTION_1: config.businessDescription,
      HERO_DESCRIPTION_2: `${config.businessName} provides ${keyword.toLowerCase()} with clear information and practical next steps.`,
      SERVICES_CONTENT: servicePageContent(config, content, keyword, imageOptions),
      META_TITLE: `${config.businessName} | ${keyword}`,
      META_DESCRIPTION: metaDescription,
      OG_TITLE: `${config.businessName} | ${keyword}`,
      OG_DESCRIPTION: metaDescription,
      TWITTER_TITLE: `${config.businessName} | ${keyword}`,
      TWITTER_DESCRIPTION: metaDescription,
      CANONICAL_URL: canonicalForPage(config, page.output, String(baseValues.CANONICAL_URL ?? ""))
    };
    return pageValues;
  }, {});
};

const escapeAttribute = (input: string): string =>
  input
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const insertFirstAnchor = (html: string, anchor: AnchorLink): { html: string; inserted: boolean } => {
  const textPattern = new RegExp(escapeRegExp(anchor.text), "i");
  const skipTags = new Set(["a", "button", "head", "iframe", "script", "style", "textarea", "title"]);
  const tagPattern = /<[^>]+>/g;
  const skippedStack: string[] = [];
  let cursor = 0;
  let output = "";

  const appendAnchoredText = (text: string): boolean => {
    if (skippedStack.length > 0) {
      output += text;
      return false;
    }

    const match = text.match(textPattern);
    if (!match?.[0] || match.index === undefined) {
      output += text;
      return false;
    }

    const before = text.slice(0, match.index);
    const matched = text.slice(match.index, match.index + match[0].length);
    const after = text.slice(match.index + match[0].length);
    output += `${before}<a href="${escapeAttribute(anchor.url)}">${matched}</a>${after}`;
    return true;
  };

  for (const tagMatch of html.matchAll(tagPattern)) {
    const tag = tagMatch[0];
    const tagIndex = tagMatch.index ?? 0;
    const beforeTag = html.slice(cursor, tagIndex);
    if (appendAnchoredText(beforeTag)) {
      return { html: `${output}${html.slice(tagIndex)}`, inserted: true };
    }

    output += tag;
    const tagName = tag.match(/^<\s*\/?\s*([a-zA-Z0-9:-]+)/)?.[1]?.toLowerCase();
    const closing = /^<\s*\//.test(tag);
    const selfClosing = /\/\s*>$/.test(tag);
    if (tagName && skipTags.has(tagName)) {
      if (closing) {
        const lastIndex = skippedStack.lastIndexOf(tagName);
        if (lastIndex >= 0) {
          skippedStack.splice(lastIndex, 1);
        }
      } else if (!selfClosing) {
        skippedStack.push(tagName);
      }
    }
    cursor = tagIndex + tag.length;
  }

  if (appendAnchoredText(html.slice(cursor))) {
    return { html: output, inserted: true };
  }

  return { html: output, inserted: false };
};

const insertAnchorInFirstH1 = (html: string, anchor: AnchorLink): { html: string; inserted: boolean } => {
  const h1Pattern = /<h1([^>]*)>([\s\S]*?)<\/h1>/i;
  const match = html.match(h1Pattern);
  if (!match?.[0] || match.index === undefined) {
    return { html, inserted: false };
  }
  if (/<a\s/i.test(match[2] ?? "")) {
    return { html, inserted: false };
  }

  const replacement = `<h1${match[1] ?? ""}><a href="${escapeAttribute(anchor.url)}">${escapeHtmlText(anchor.text)}</a></h1>`;
  return {
    html: `${html.slice(0, match.index)}${replacement}${html.slice(match.index + match[0].length)}`,
    inserted: true
  };
};

const anchorContentBlock = (anchor: AnchorLink): string => `
  <section class="block article-block">
    <h2><a href="${escapeAttribute(anchor.url)}">${escapeHtmlText(anchor.text)}</a></h2>
  </section>`;

const insertAnchorBlockBeforeMedia = (html: string, anchor: AnchorLink): string => {
  const marker = html.search(/<section\s+class=["'][^"']*(?:faq-section|video-section|video-block|embed-section)\b/i);
  const block = anchorContentBlock(anchor);
  return marker >= 0 ? `${html.slice(0, marker)}${block}${html.slice(marker)}` : `${html}${block}`;
};

const insertHomePageAnchors = (html: string, anchors: AnchorLink[], insertedIndexes: Set<number>): string => {
  let currentHtml = html;
  for (const [index, anchor] of anchors.entries()) {
    if (insertedIndexes.has(index)) {
      continue;
    }
    const result = index === 0 ? insertAnchorInFirstH1(currentHtml, anchor) : insertFirstAnchor(currentHtml, anchor);
    currentHtml = result.inserted ? result.html : insertAnchorBlockBeforeMedia(currentHtml, anchor);
    insertedIndexes.add(index);
  }

  return currentHtml;
};

export class StructuredJsonGeneratorEngine implements GenerationEngineRunner {
  readonly name = "structured-json-generator" as const;

  constructor(private readonly structuredJsonService?: StructuredJsonService) {}

  async run(state: GenerationState) {
    const fallback = createFallbackTemplateContent(state.wizardConfig);
    if (!this.structuredJsonService) {
      return {
        task: "Built structured business JSON without an external model.",
        state: {
          ...state,
          templateContent: fallback,
          placeholderValues: flattenTemplateContent(fallback)
        }
      };
    }

    let content: TemplateContent;
    try {
      content = await this.structuredJsonService.generateJson<TemplateContent>(`
Return JSON only.
Convert this business profile into structured website content.
Do not generate HTML, CSS, JavaScript, markdown, layouts, sections, animations, responsive code, or class names.
Generate only structured text fields.
Write content that is specific to the provided business description, industry, location, homePageKeywords, serviceKeywordGroups, contact details, and selected services.
Avoid generic filler phrases such as "clear information", "useful next steps", "better decision", or repeated claims unless they are supported by concrete business details.
Every home page and service page should feel like a distinct SEO article for a real business, with practical explanations, local/service context when available, and varied section headings.
Use homePageKeywords for every home page, but make each homePages item unique.
Home page style: long-form SEO/editorial article like the provided Home-page-1.docx sample. Each homePages item should have a strong title, a detailed intro, and 8 to 10 clear sections. Each section body should be 70 to 110 words and useful, not a one-line summary.
Service page style: long-form service guide like the provided Services drop down button 1.docx sample. Generate one servicePages item for every keyword inside every serviceKeywordGroups item. Each keyword is a separate Services dropdown option, a separate service page file, and needs its own distinct service page content with 7 to 9 clear sections. Each section body should be 70 to 110 words.
About page style: same length and style as the provided About_us_content.docx sample. Generate one common about object for every generated website, with 8 to 9 detailed description paragraphs of 70 to 100 words each.
Always generate exactly 5 FAQ items.
If business profile includes anchorLinks, include every anchorLinks.text exact phrase naturally in the home page content. The first anchorLinks item must be suitable as the exact home page H1.
Return a complete JSON object matching this contract. Do not truncate strings. Keep pageContent values empty strings because the renderer builds HTML.
Business profile:
${JSON.stringify(state.wizardConfig, null, 2)}
JSON contract:
${structuredContentContract}
`, { maxOutputTokens: structuredJsonTokenBudgetFor(state.wizardConfig) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI generation failed.";
      throw new Error(`AI structured JSON generation failed: ${message}`);
    }
    const normalizedAbout = normalizeAbout(content.about, fallback.about);
    const normalized: TemplateContent = {
      ...fallback,
      ...content,
      logoMarkup: fallback.logoMarkup,
      dropdownLabel: state.wizardConfig.dropdownLabel?.trim() || fallback.dropdownLabel,
      serviceKeywords: fallback.serviceKeywords,
      youtubeEmbedCode: state.wizardConfig.youtubeEmbedCode?.trim() ?? fallback.youtubeEmbedCode,
      googleDocsEmbedCode: state.wizardConfig.googleDocsEmbedCode?.trim() ?? fallback.googleDocsEmbedCode,
      googlePresentationEmbedCode: state.wizardConfig.googlePresentationEmbedCode?.trim() ?? fallback.googlePresentationEmbedCode,
      googleSheetsEmbedCode: state.wizardConfig.googleSheetsEmbedCode?.trim() ?? fallback.googleSheetsEmbedCode,
      mapEmbedCode: state.wizardConfig.mapEmbedCode?.trim() ?? fallback.mapEmbedCode,
      contactMapEmbedCode: state.wizardConfig.contactMapEmbedCode?.trim() ?? fallback.contactMapEmbedCode,
      contact: { ...fallback.contact, ...content.contact },
      hero: { ...fallback.hero, ...content.hero },
      about: normalizedAbout,
      services: content.services?.length ? content.services : fallback.services,
      features: content.features?.length ? content.features : fallback.features,
      testimonials: content.testimonials?.length ? content.testimonials : fallback.testimonials,
      faq: exactFiveFaqs(content.faq, fallback.faq),
      seo: { ...fallback.seo, ...content.seo },
      homePages: normalizeHomePages(content.homePages, fallback.homePages),
      servicePages: normalizeServicePages(content.servicePages, fallback.servicePages),
      pageContent: {
        ...fallback.pageContent,
        about: structuredAboutContentToHtml(normalizedAbout, state.wizardConfig)
      }
    };

    return {
      task: `Generated structured business JSON using ${this.structuredJsonService.describe?.() ?? "configured AI provider"}.`,
      state: {
        ...state,
        templateContent: normalized,
        placeholderValues: flattenTemplateContent(normalized)
      }
    };
  }
}

export class ImageGeneratorEngine implements GenerationEngineRunner {
  readonly name = "image-generator" as const;

  constructor(private readonly imageService?: WebsiteImageService) {}

  async run(state: GenerationState) {
    const requirements = buildImageRequirements(state.wizardConfig);
    if (requirements.length === 0) {
      return {
        task: "Skipped image handling because no page images were requested.",
        state: { ...state, generatedImages: [] }
      };
    }

    if (state.generatedImages?.length) {
      return this.completedResult(state, state.generatedImages, `Resolved ${state.generatedImages.length} uploaded website images.`);
    }

    const mode = state.wizardConfig.imageSourceMode ?? "forge";
    if (mode === "prompt-upload") {
      return {
        task: `Prepared ${requirements.length} image prompts. Upload images to continue generation.`,
        state: { ...state, generatedImages: [] },
        paused: {
          reason: "waiting-for-images" as const,
          requirements
        }
      };
    }

    if (!this.imageService) {
      return {
        task: "Skipped AI image generation; using built-in template images.",
        state: { ...state, generatedImages: [] }
      };
    }

    try {
      const generatedImages = mode === "url"
        ? await this.imageService.resolveUrlImages(state.wizardConfig, requirements)
        : await this.imageService.generateWebsiteImages(state.wizardConfig, requirements);
      return this.completedResult(
        state,
        generatedImages,
        mode === "url"
          ? `Fetched ${generatedImages.length} website images from supplied URLs.`
          : `Generated ${generatedImages.length} distinct website images.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image generation failed.";
      throw new Error(`${mode === "url" ? "Image URL import" : "AI image generation"} failed: ${message}`);
    }
  }

  private completedResult(state: GenerationState, generatedImages: GeneratedImageAsset[], task: string) {
    return {
      task,
      state: {
        ...state,
        generatedImages,
        assets: [
          ...state.assets,
          ...generatedImages.map((image) => ({
            id: crypto.randomUUID(),
            projectId: state.project.id,
            jobId: state.project.lastGenerationJobId ?? "",
            type: "image" as const,
            path: image.relativePath,
            url: "",
            alt: image.alt,
            createdAt: new Date().toISOString()
          }))
        ],
        artifacts: [...state.artifacts, ...generatedImages.map((image) => ({
          relativePath: image.relativePath,
          content: image.content,
          contentType: image.contentType
        }))]
      }
    };
  }
}

export class TemplateRendererEngine implements GenerationEngineRunner {
  readonly name = "template-renderer" as const;

  constructor(
    private readonly library = new TemplateLibrary(),
    private readonly renderer = new TemplateRenderer()
  ) {}

  async run(state: GenerationState) {
    const requestedPageCount = Math.max(1, Math.min(50, state.wizardConfig.pageCount ?? 1));
    const allTemplates = await this.library.listTemplates();
    if (allTemplates.length === 0) {
      throw new Error("No website templates are registered.");
    }
    const requestedTemplateIds = state.wizardConfig.templateIds?.length
      ? state.wizardConfig.templateIds
      : state.wizardConfig.templateId
        ? [state.wizardConfig.templateId]
        : [];
    const selectedTemplates = requestedTemplateIds.length
      ? requestedTemplateIds
          .map((templateId) => allTemplates.find((template) => template.manifest.id === templateId))
          .filter((template): template is SelectedTemplate => Boolean(template))
      : [await this.library.selectTemplate(undefined, state.wizardConfig.industry)];
    if (selectedTemplates.length === 0) {
      throw new Error("Select at least one website template.");
    }
    const selectedTemplate = selectedTemplates[0]!;
    const templateContent = state.templateContent ?? createFallbackTemplateContent(state.wizardConfig);
    const serviceKeywordGroups = serviceKeywordGroupsFor(state.wizardConfig, templateContent, requestedPageCount);
    const anchorLinks = normalizeAnchorLinks(state.wizardConfig);
    const includedPages = selectedPageKinds(state.wizardConfig);
    const eligibleTemplates = selectedTemplates
      .filter((template) => templateWithSelectedPages(template, includedPages, serviceKeywordGroups[0] ?? templateContent.serviceKeywords).manifest.supportedPages.length > 0);
    if (eligibleTemplates.length === 0) {
      throw new Error("The selected templates do not support the selected pages.");
    }
    const renderTargets: Array<{ template: SelectedTemplate; prefix: string; templateIndex: number; pageNumber: number }> = [];

    let pageNumber = 1;
    for (const [templateIndex, template] of eligibleTemplates.entries()) {
      const remainingTemplates = eligibleTemplates.length - templateIndex;
      const remainingPages = requestedPageCount - renderTargets.length;
      const pagesForTemplate = Math.ceil(remainingPages / remainingTemplates);
      for (let templatePageNumber = 0; templatePageNumber < pagesForTemplate && renderTargets.length < requestedPageCount; templatePageNumber += 1) {
        renderTargets.push({
          template,
          prefix: `Template ${templateIndex + 1}/${pageNumber}`,
          templateIndex,
          pageNumber
        });
        pageNumber += 1;
      }
    }

    const now = new Date().toISOString();
    const reports: TemplateRenderReport[] = [];
    const artifacts: BuildArtifact[] = [];
    const pages: GeneratedPage[] = [];
    const assets: GeneratedAsset[] = [...state.assets];

    for (const target of renderTargets) {
      const insertedAnchorIndexes = new Set<number>();
      const targetServiceKeywords = serviceKeywordGroups[target.pageNumber - 1] ?? serviceKeywordGroups[0] ?? templateContent.serviceKeywords;
      const imageOptions: RenderImageOptions = { generatedImages: homeImageSources(state, target.pageNumber - 1) };
      const targetTemplateContent = contentForRenderTarget(state.wizardConfig, templateContent, targetServiceKeywords, target.pageNumber - 1, imageOptions);
      const targetValues = flattenTemplateContent(targetTemplateContent);
      targetValues.ABOUT_CONTENT = stripGeneratedArticleImages(String(targetValues.ABOUT_CONTENT ?? ""));
      const targetTemplate = templateWithSelectedPages(target.template, includedPages, targetServiceKeywords);
      const result = await this.renderer.render(
        targetTemplate,
        targetValues,
        servicePageValues(state.wizardConfig, targetTemplateContent, targetTemplate, targetServiceKeywords, targetValues, target.pageNumber - 1, state)
      );
      if (result.report.missingRequiredPlaceholders.length > 0 || result.report.unreplacedPlaceholders.length > 0) {
        throw new Error(
          `Template rendering validation failed for "${targetTemplate.manifest.id}". Missing: ${result.report.missingRequiredPlaceholders.join(", ") || "none"}. Unreplaced: ${
            result.report.unreplacedPlaceholders.join(", ") || "none"
          }.`
        );
      }

      const nextArtifacts = prefixArtifacts(result.artifacts, target.prefix);
      const nextReport = {
        ...result.report,
        renderedPages: result.report.renderedPages.map((page) => toPosix(path.posix.join(target.prefix, page))),
        copiedAssets: result.report.copiedAssets.map((asset) => toPosix(path.posix.join(target.prefix, asset)))
      };
      reports.push(nextReport);
      const htmlArtifacts = nextArtifacts.filter((artifact) => artifact.contentType === "text/html");
      for (const artifact of htmlArtifacts) {
        const kind = pageKindFor(targetTemplate, artifact.relativePath);
        const navigationAdjustedHtml = removePageLinks(String(artifact.content), includedPages);
        const html = kind === "home" && insertedAnchorIndexes.size < anchorLinks.length
          ? insertHomePageAnchors(navigationAdjustedHtml, anchorLinks, insertedAnchorIndexes)
          : navigationAdjustedHtml;
        artifact.content = html;
        const slug = slugFromOutputPath(artifact.relativePath);
        const title = titleFromRenderedHtml(html, `${state.wizardConfig.businessName} ${kind}`);
        const metaDescription = descriptionFromRenderedHtml(html, state.wizardConfig.businessDescription);
        pages.push({
          id: pageId(state.project.id, state.project.lastGenerationJobId ?? now, slug),
          projectId: state.project.id,
          jobId: state.project.lastGenerationJobId ?? "",
          slug,
          kind,
          title,
          metaDescription,
          headings: headingsFromRenderedHtml(html),
          html,
          wordCount: countWords(stripHtml(html)),
          status: "rendered",
          version: 1,
          createdAt: now,
          updatedAt: now
        });
      }
      artifacts.push(...nextArtifacts);

      assets.push(...nextArtifacts
        .filter((artifact) => artifact.contentType !== "text/html")
        .map((artifact) => {
          const type: GeneratedAsset["type"] = artifact.relativePath.endsWith(".png") || artifact.relativePath.endsWith(".jpg") || artifact.relativePath.endsWith(".webp")
            ? "image"
            : "download";

          return {
            id: crypto.randomUUID(),
            projectId: state.project.id,
            jobId: state.project.lastGenerationJobId ?? "",
            type,
            path: artifact.relativePath,
            url: "",
            createdAt: now
          };
        }));
    }

    const renderingReport: TemplateRenderReport = {
      templateId: requestedPageCount === 1 ? selectedTemplate.manifest.id : "batch",
      templateName: requestedPageCount === 1 ? selectedTemplate.manifest.name : `${reports.length} rendered template pages`,
      renderedPages: reports.flatMap((report) => report.renderedPages),
      copiedAssets: reports.flatMap((report) => report.copiedAssets),
      replacedPlaceholderCount: reports.reduce((sum, report) => sum + report.replacedPlaceholderCount, 0),
      missingRequiredPlaceholders: [],
      unreplacedPlaceholders: [],
      durationMs: reports.reduce((sum, report) => sum + report.durationMs, 0)
    };

    return {
      task: requestedPageCount === 1
        ? `Rendered 1 complete website from "${selectedTemplate.manifest.name}" in ${renderingReport.durationMs}ms.`
        : `Rendered ${renderTargets.length} complete websites across ${new Set(renderTargets.map((target) => target.template.manifest.id)).size} selected templates in ${renderingReport.durationMs}ms.`,
      state: {
        ...state,
        selectedTemplate,
        selectedTemplates: requestedPageCount === 1 ? [selectedTemplate] : eligibleTemplates,
        renderingReport,
        pages,
        assets,
        artifacts: [...state.artifacts, ...artifacts]
      }
    };
  }
}

export class PreviewBuilderEngine implements GenerationEngineRunner {
  readonly name = "preview-builder" as const;

  async run(state: GenerationState) {
    const htmlArtifactPaths = state.artifacts.filter((artifact) => artifact.contentType === "text/html").map((artifact) => artifact.relativePath);
    const urls = htmlArtifactPaths.map((pathName) => `/${pathName}`);
    const manifest = {
      name: state.wizardConfig.businessName,
      short_name: state.wizardConfig.businessName.slice(0, 12),
      start_url: "/",
      display: "standalone"
    };
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
      .map((url) => `<url><loc>${url}</loc></url>`)
      .join("")}</urlset>`;
    const artifacts = [
      { relativePath: "Extra/robots.txt", content: "User-agent: *\nAllow: /\nSitemap: /Extra/sitemap.xml\n", contentType: "text/plain" },
      { relativePath: "Extra/sitemap.xml", content: sitemap, contentType: "application/xml" },
      { relativePath: "Extra/manifest.json", content: JSON.stringify(manifest, null, 2), contentType: "application/manifest+json" },
      { relativePath: "Extra/structured-content.json", content: JSON.stringify(state.templateContent, null, 2), contentType: "application/json" },
      { relativePath: "Extra/render-report.json", content: JSON.stringify(state.renderingReport, null, 2), contentType: "application/json" }
    ];
    return {
      task: "Prepared preview artifacts.",
      state: { ...state, artifacts: [...state.artifacts, ...artifacts] }
    };
  }
}

export class ZipExportEngine implements GenerationEngineRunner {
  readonly name = "zip-export" as const;

  async run(state: GenerationState) {
    const jobId = state.project.lastGenerationJobId ?? state.project.id;
    const zipFileName = `${sanitizeFileName(state.wizardConfig.businessName)}_Home_Pages.zip`;
    const zipPath = path.join(workerConfig.tmpRoot, "zips", jobId, zipFileName);
    return {
      task: "Prepared ZIP export.",
      state: { ...state, zipPath }
    };
  }
}
