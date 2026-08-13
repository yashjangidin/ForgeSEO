import { serviceKeywordToFileName, type SocialPlatform, type WizardConfig } from "@forgeseo/shared";
import type { PlaceholderValue } from "./types.js";

export interface TemplateContent {
  businessName: string;
  logoMarkup: string;
  tagline: string;
  primaryCta: string;
  secondaryCta?: string;
  canonicalUrl: string;
  dropdownLabel: string;
  serviceKeywords: string[];
  youtubeEmbedCode: string;
  googleDocsEmbedCode: string;
  googlePresentationEmbedCode: string;
  googleSheetsEmbedCode: string;
  mapEmbedCode: string;
  contactMapEmbedCode: string;
  socialLinks: Array<{
    platform: SocialPlatform;
    label: string;
    url: string;
  }>;
  contact: {
    phone?: string;
    email?: string;
    address?: string;
    hours?: string;
    websiteUrl?: string;
  };
  hero: {
    title: string;
    subtitle: string;
    description: string[];
  };
  about: {
    title: string;
    description: string[];
  };
  services: Array<{
    title: string;
    description: string;
  }>;
  features: Array<{
    title: string;
    description: string;
  }>;
  testimonials: Array<{
    quote: string;
    name: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  seo: {
    title: string;
    metaDescription: string;
    openGraphTitle: string;
    openGraphDescription: string;
    twitterTitle: string;
    twitterDescription: string;
    schema: Record<string, unknown>;
  };
  homePages?: Array<{
    title: string;
    intro: string;
    sections: Array<{
      heading: string;
      body: string;
    }>;
  }>;
  servicePages?: Array<{
    keyword: string;
    keywords: string[];
    title: string;
    intro: string;
    sections: Array<{
      heading: string;
      body: string;
    }>;
  }>;
  pageContent: {
    home: string;
    services: string;
    about: string;
    contact: string;
  };
}

export interface RenderImageOptions {
  generatedImages?: string[];
}

const pick = <T>(items: T[], index: number, fallback: T): T => items[index] ?? fallback;

const sentence = (input: string): string => input.trim().replace(/\s+/g, " ");

const escapeHtml = (input: string | undefined): string =>
  (input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const escapeAttribute = (input: string | undefined): string => escapeHtml(input);

const escapeHtmlWithLineBreaks = (input: string | undefined): string =>
  escapeHtml(input).replace(/\r?\n/g, "<br>");

const paragraphs = (items: string[]): string => items.map((item) => `<p>${escapeHtml(item)}</p>`).join("");

const userProvidedEmbed = (input: string | undefined): string => input?.trim() ?? "";
const logoDataUrlMaxLength = 7_000_000;
const socialMeta: Record<SocialPlatform, { label: string; icon: string }> = {
  linkedin: {
    label: "LinkedIn",
    icon: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4v15h-4V8zm7 0h3.8v2.05h.05c.53-1 1.82-2.05 3.75-2.05 4.01 0 4.75 2.64 4.75 6.07V23h-4v-7.92c0-1.89-.03-4.32-2.63-4.32-2.64 0-3.04 2.06-3.04 4.18V23h-4V8z"/></svg>'
  },
  instagram: {
    label: "Instagram",
    icon: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.25-2.7a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/></svg>'
  },
  x: {
    label: "X",
    icon: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.9 2h3.3l-7.2 8.23L23.5 22h-6.65l-5.2-6.8L5.7 22H2.4l7.7-8.8L2 2h6.82l4.7 6.22L18.9 2zm-1.16 17.93h1.83L7.82 3.96H5.86l11.88 15.97z"/></svg>'
  },
  facebook: {
    label: "Facebook",
    icon: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 12.06C22 6.48 17.52 2 11.94 2S2 6.48 2 12.06c0 5.03 3.68 9.2 8.5 9.94v-7.03H7.98v-2.91h2.52V9.84c0-2.49 1.48-3.86 3.75-3.86 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22c4.82-.74 8.41-4.91 8.41-9.94z"/></svg>'
  },
  youtube: {
    label: "YouTube",
    icon: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.12C19.55 3.58 12 3.58 12 3.58s-7.55 0-9.4.5A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.12c1.85.5 9.4.5 9.4.5s7.55 0 9.4-.5a3 3 0 0 0 2.1-2.12A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>'
  }
};

const limitWords = (input: string, maxWords: number): string => {
  const words = sentence(input).split(/\s+/).filter(Boolean);
  const limited = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${limited.replace(/[.,;:!?]+$/, "")}.` : limited;
};

const wordCount = (input: string): number => sentence(input).split(/\s+/).filter(Boolean).length;

const footerDescription = (content: TemplateContent): string => {
  const primaryDescription = content.hero.description.find((item) => item.trim().length > 80)
    ?? content.about.description.find((item) => item.trim().length > 80)
    ?? content.seo.metaDescription
    ?? content.tagline;
  const base = limitWords(primaryDescription, 30);
  const servicePhrase = content.serviceKeywords.length
    ? `Explore ${content.serviceKeywords.slice(0, 2).join(" and ").toLowerCase()} or contact the team for next steps.`
    : "Explore the services or contact the team for next steps.";
  const combined = `${base} ${servicePhrase}`;
  return wordCount(combined) <= 40 ? combined : base;
};

const validLogoDataUrl = (input: string | undefined): string | undefined => {
  const value = input?.trim();
  if (!value || value.length > logoDataUrlMaxLength) {
    return undefined;
  }
  return /^data:image\/(?:png|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : undefined;
};

const logoMarkupFor = (config: WizardConfig): string => {
  const logoDataUrl = config.customLogoEnabled ? validLogoDataUrl(config.logoDataUrl) : undefined;
  if (logoDataUrl) {
    return `<img src="${escapeAttribute(logoDataUrl)}" alt="${escapeAttribute(`${config.businessName} logo`)}">`;
  }
  return `<span>${escapeHtml(config.businessName)}</span>`;
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

const servicesNavItems = (serviceKeywords: string[]): string =>
  serviceKeywords
    .map((keyword, index) => {
      const className = index === 0 ? ' class="highlight-link"' : "";
      return `<a${className} href="${serviceKeywordToFileName(keyword)}">${escapeHtml(keyword)}</a>`;
    })
    .join("\n          ");

const configuredSocialLinks = (config: WizardConfig): TemplateContent["socialLinks"] =>
  (config.socialLinks ?? []).reduce<TemplateContent["socialLinks"]>((links, social) => {
    const url = social.url.trim();
    if (!url || links.some((item) => item.platform === social.platform)) {
      return links;
    }
    links.push({
      platform: social.platform,
      label: socialMeta[social.platform].label,
      url
    });
    return links;
  }, []);

const socialLinksMarkup = (links: TemplateContent["socialLinks"]): string =>
  links
    .map((link) => `<a href="${escapeAttribute(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttribute(link.label)}" title="${escapeAttribute(link.label)}">${socialMeta[link.platform].icon}</a>`)
    .join("\n        ");

const socialSectionMarkup = (links: TemplateContent["socialLinks"]): string =>
  links.length
    ? `<div class="footer-col social-footer-col">
      <h4>Follow Us</h4>
      <div class="follow-row">
        ${socialLinksMarkup(links)}
      </div>
    </div>`
    : "";

const contactForm = (businessName: string, contactEmail?: string): string => `
      <div class="contact-card">
        <h2>Get in touch</h2>
        <p class="sub">${escapeHtml(contactEmail ? `Email ${businessName} at ${contactEmail}.` : `Send a message to ${businessName} with your question or requirement.`)}</p>
        <form onsubmit="return false;">
          <div class="field"><label for="name">Name</label><input type="text" id="name" placeholder="Your name"></div>
          <div class="field"><label for="email">Email</label><input type="email" id="email" placeholder="you@example.com"></div>
          <div class="field"><label for="subject">Subject</label><input type="text" id="subject" placeholder="What is this about?"></div>
          <div class="field"><label for="message">Message</label><textarea id="message" placeholder="Write your message..."></textarea></div>
          <button class="submit-btn" type="submit">Send Message</button>
        </form>
      </div>`;

const contactDetails = (content: Pick<TemplateContent, "businessName" | "contact">): string => {
  const details = [
    content.contact.phone ? ["Phone", content.contact.phone] : undefined,
    content.contact.email ? ["Email", content.contact.email] : undefined,
    content.contact.address ? ["Address", content.contact.address] : undefined,
    content.contact.hours ? ["Hours", content.contact.hours] : undefined,
    content.contact.websiteUrl ? ["Website", content.contact.websiteUrl] : undefined
  ].filter((item): item is string[] => Boolean(item));
  const rows = details.length
    ? details.map(([label, value]) => `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtmlWithLineBreaks(value)}</span></li>`).join("")
    : `<li><strong>Contact</strong><span>${escapeHtml(`Send your enquiry to ${content.businessName}.`)}</span></li>`;

  return `
      <div class="contact-card contact-details-card">
        <h2>Contact details</h2>
        <p class="sub">${escapeHtml(`Reach ${content.businessName} using the details below.`)}</p>
        <ul class="contact-details-list">${rows}</ul>
      </div>`;
};

const contactMap = (mapEmbedCode?: string): string => `
      <div class="contact-card map-card">
        <h2>Location map</h2>
        ${mapEmbedCode?.trim() || '<p class="sub">Map embed code was not provided.</p>'}
      </div>`;

const homeEmbedCard = (title: string, embedCode?: string, className = ""): string => {
  const embed = embedCode?.trim();
  return embed ? `<div class="embed-card${className ? ` ${className}` : ""}"><h3>${escapeHtml(title)}</h3>${embed}</div>` : "";
};

const homeVideoSection = (embedCode?: string): string => {
  const embed = embedCode?.trim();
  return embed
    ? `<section class="block video-block">
    <h2>YouTube Video</h2>
    <div class="video-card">${embed}</div>
  </section>`
    : "";
};

const homeEmbedCluster = (content: Pick<TemplateContent, "googleDocsEmbedCode" | "googlePresentationEmbedCode" | "googleSheetsEmbedCode" | "mapEmbedCode" | "contactMapEmbedCode">): string => {
  const cards = [
    homeEmbedCard("Google Docs", content.googleDocsEmbedCode),
    homeEmbedCard("Google Presentation", content.googlePresentationEmbedCode, "presentation"),
    homeEmbedCard("Google Sheets", content.googleSheetsEmbedCode),
    homeEmbedCard("Location Map", content.mapEmbedCode)
  ].filter(Boolean);
  const largeMap = homeEmbedCard("Location Map", content.contactMapEmbedCode || content.mapEmbedCode, "home-map-card");

  return cards.length || largeMap
    ? `<section class="embed-section">
    <h2 class="section-title">Google Embeds</h2>
    ${cards.length ? `<div class="embed-grid">${cards.join("")}</div>` : ""}
    ${largeMap}
  </section>`
    : "";
};

const inferBusinessTerms = (config: WizardConfig): string[] => {
  const words = config.businessDescription
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 4);
  return Array.from(new Set([config.industry, ...words, config.businessName])).slice(0, 6);
};

const configuredHomeKeywords = (config: WizardConfig): string[] =>
  uniqueNonEmpty([...(config.homePageKeywords ?? []), config.industry, config.businessName]);

const configuredServiceKeywordGroups = (config: WizardConfig): string[][] => {
  const pageCount = Math.max(1, Math.min(50, config.pageCount ?? 1));
  return Array.from({ length: pageCount }, (_, index) => {
    const group = config.serviceKeywordGroups?.[index]?.keywords ?? [];
    const legacyKeyword = config.serviceKeywords?.[index] ?? (index === 0 ? config.dropdownLabel : undefined);
    const keywords = uniqueNonEmpty([...group, legacyKeyword]);
    return keywords.length ? keywords : [config.industry];
  });
};

const homePageFromKeywords = (config: WizardConfig, pageIndex: number, keywords: string[]): NonNullable<TemplateContent["homePages"]>[number] => {
  const leadKeyword = keywords[pageIndex % keywords.length] ?? config.industry;
  const supportingKeyword = keywords[(pageIndex + 1) % keywords.length] ?? config.businessName;
  return {
    title: `${config.businessName} for ${leadKeyword}`,
    intro: `${config.businessName} helps visitors understand ${leadKeyword.toLowerCase()} with clear explanations, practical details, and useful next steps. This page is written as a long-form guide so readers can understand the topic, compare their options, and decide what to do next without feeling rushed.`,
    sections: [
      {
        heading: `Why Choose ${leadKeyword}?`,
        body: `${leadKeyword} matters because visitors usually want more than a quick claim or short feature list. They want to know how the service works, what problem it solves, and why it may be a better fit for their situation. ${config.businessName} presents the information in a clear, practical way so readers can move through the page naturally.`
      },
      {
        heading: `A More Useful Experience for ${supportingKeyword}`,
        body: `A helpful website should explain the subject without forcing readers to search across several disconnected pages. This content connects ${supportingKeyword.toLowerCase()} with the main offer, giving visitors enough context to understand the value, the use cases, and the next step.`
      },
      {
        heading: "Clear Information Before Taking Action",
        body: `People often compare several options before contacting a business. ${config.businessName} supports that decision-making process by describing the service, explaining what users can expect, and keeping the page focused on real questions a visitor may have before reaching out.`
      },
      {
        heading: "Built for Different Types of Visitors",
        body: `Some readers may be ready to contact the business immediately, while others may still be researching. This page gives both groups a useful path. It provides introductory context, practical explanations, and enough detail for people who want to understand the topic more deeply before making a decision.`
      },
      {
        heading: "How the Service Fits Everyday Needs",
        body: `${leadKeyword} can support visitors who want reliable information, convenient access, and a smoother experience. By keeping the explanation direct and organized, ${config.businessName} helps readers see how the service can fit into their plans without unnecessary confusion.`
      },
      {
        heading: "Important Details to Consider",
        body: `Before choosing any provider, visitors usually want to understand quality, convenience, communication, pricing expectations, and overall reliability. A strong page should address those concerns in plain language. This section gives the topic more depth while keeping the tone approachable and easy to follow.`
      },
      {
        heading: "What Makes the Experience Different?",
        body: `${config.businessName} focuses on clarity and usefulness. Instead of relying only on broad claims, the page explains the benefits in a way that connects with real visitor intent. This helps the website feel more trustworthy, informative, and relevant to the search that brought someone there.`
      },
      {
        heading: "Practical Uses and Benefits",
        body: `The service can be useful for people who want a simpler way to solve a specific problem, learn about available options, or contact a provider with confidence. The content is structured so each section adds another layer of understanding rather than repeating the same point.`
      },
      {
        heading: "How to Get Started",
        body: `Visitors can begin by reviewing the service options, reading the supporting information, and using the contact page when they are ready. The goal is to make the journey feel straightforward from the first heading to the final call to action.`
      },
      {
        heading: "Creating Better Results With Clear Questions",
        body: `A better outcome often starts with clear communication. When visitors know what they need, what they are unsure about, and what they want to ask, it becomes easier for ${config.businessName} to provide useful next steps.`
      },
      {
        heading: "Conclusion",
        body: `${leadKeyword} is easier to understand when the information is organized, specific, and written for real readers. ${config.businessName} uses this page to explain the service, support visitor confidence, and create a smooth path toward action.`
      }
    ]
  };
};

const servicePageFromKeyword = (config: WizardConfig, keyword: string, siblingKeywords: string[]): NonNullable<TemplateContent["servicePages"]>[number] => {
  const relatedKeywords = siblingKeywords.filter((item) => item.toLowerCase() !== keyword.toLowerCase());
  return {
    keyword,
    keywords: [keyword],
    title: keyword,
    intro: `${config.businessName} provides ${keyword.toLowerCase()} with business-specific guidance, clear details, and simple contact paths. This service page is written as a focused long-form guide so visitors can understand what the service means, why it matters, and how it can help them make a better decision.`,
    sections: [
      {
        heading: `What Is ${keyword}?`,
        body: `${keyword} is a specific service area that deserves its own explanation. Visitors need to understand what it includes, how it may apply to their situation, and what type of result they can reasonably expect. ${config.businessName} keeps this page focused on that one service so the information stays relevant.`
      },
      {
        heading: "Why This Service Matters",
        body: `A dedicated service page helps people move beyond a basic navigation label. It gives them practical context, answers common questions, and explains the value of the service in a way that supports trust. This is especially important when visitors are comparing several providers or service types.`
      },
      {
        heading: "How This Service Supports User Control",
        body: `${keyword} gives visitors a clearer way to understand what they are choosing. Instead of placing every detail on one general services page, the website separates this topic so users can focus on the information that matches their interest.`
      },
      {
        heading: "What Visitors Should Know First",
        body: `Before taking action, visitors often want to know what the service involves, what information they may need to provide, and how the process usually begins. This section gives them a practical overview without overwhelming them with unnecessary detail.`
      },
      {
        heading: "Practical Uses for This Service",
        body: `${keyword} can be useful when someone wants a direct answer, a reliable option, or a provider that clearly explains the next step. The content is designed to help readers understand the service from several angles before they decide whether to continue.`
      },
      {
        heading: relatedKeywords.length ? "Related Service Options" : "Service Details",
        body: relatedKeywords.length
          ? `${config.businessName} keeps this service connected with ${relatedKeywords.join(", ").toLowerCase()} while giving ${keyword.toLowerCase()} its own dedicated page.`
          : `${config.businessName} keeps the page focused on the main service keyword with helpful supporting details.`
      },
      {
        heading: "The Role of Clear Communication",
        body: `Clear communication helps visitors understand whether the service fits their needs. ${config.businessName} presents this information in a straightforward style so people can ask better questions and receive more useful guidance.`
      },
      {
        heading: "What Makes a Service Page Useful?",
        body: `A useful service page should explain the topic, describe the benefits, reduce confusion, and lead naturally toward contact or another relevant action. It should not feel like a thin placeholder. This page is intentionally structured with enough depth to support real search intent.`
      },
      {
        heading: "Choosing the Right Option",
        body: `The right choice depends on the visitor's goal, timeline, expectations, and comfort level. By reading through the page, visitors can compare the service with their needs and decide whether ${config.businessName} is the right next step.`
      },
      {
        heading: "How to Move Forward",
        body: "The page gives visitors enough clarity to compare the service, ask questions, and take the next step with confidence."
      }
    ]
  };
};

const articleImage = (src: string, alt: string): string => `
  <div class="media-card article-image"><img src="${src}" alt="${escapeHtml(alt)}"></div>`;

const configuredImageCount = (value: number | undefined): number => Math.max(0, Math.min(20, value ?? 3));

const sharedArticleImages = [
  "creative-storytelling.png",
  "idea-exploration.png",
  "privacy-chat.png",
  "hero-chat.png"
];

const sharedImagePool = (config: WizardConfig, options: RenderImageOptions = {}): string[] => {
  const imageLimit = Math.max(configuredImageCount(config.homeImageCount), configuredImageCount(config.serviceImageCount));
  if (options.generatedImages?.length) {
    return Array.from({ length: imageLimit }, (_, index) => options.generatedImages![index % options.generatedImages!.length]!);
  }
  return Array.from({ length: imageLimit }, (_, index) => sharedArticleImages[index % sharedArticleImages.length]!);
};

const contentBlock = (heading: string, body: string): string => `
  <section class="block article-block">
    <h2>${escapeHtml(heading)}</h2>
    ${paragraphs(body.split(/\n+/).map((item) => item.trim()).filter(Boolean))}
  </section>`;

const homeSectionBody = (body: string, config: WizardConfig, heading: string): string => `${body}
This section is written to give visitors more than a short summary. It explains the topic in plain language, adds practical context, and helps readers connect ${heading.toLowerCase()} with the reason they arrived on the website in the first place.
For ${config.businessName}, the page should feel useful even before someone clicks a button. The content therefore gives enough detail for research-focused visitors while still keeping the path toward services, supporting resources, and contact options easy to follow.`;

const serviceSectionBody = (body: string, config: WizardConfig, keyword: string): string => `${body}
This service information is designed for visitors who may be comparing options, checking details, or trying to understand whether ${keyword.toLowerCase()} matches their exact need. Clear service pages reduce confusion by keeping one topic focused and complete.
${config.businessName} keeps this page practical by explaining expectations, benefits, and next steps in a steady sequence. That makes the service page useful for search visitors, returning users, and people who want to ask more specific questions before contacting the business.`;

const aboutSectionBody = (body: string, config: WizardConfig): string => `${body}
The goal is to present ${config.businessName} as clear, approachable, and useful without making the page feel thin. Visitors should be able to understand the purpose of the business, the thinking behind the website, and the kind of experience they can expect.
This page also supports trust by giving the business a fuller explanation. Instead of only listing services, it explains the reason those services matter and shows how ${config.businessName} wants to help people move from curiosity to confident action.`;

export const structuredHomeContentToHtml = (content: NonNullable<TemplateContent["homePages"]>[number], config: WizardConfig, options: RenderImageOptions = {}): string => {
  const imageLimit = configuredImageCount(config.homeImageCount);
  const images = sharedImagePool(config, options).slice(0, imageLimit);
  let insertedImages = 0;
  const addImage = (alt: string): string => {
    if (insertedImages >= imageLimit) {
      return "";
    }
    const src = images[insertedImages % images.length];
    if (!src) {
      return "";
    }
    insertedImages += 1;
    return articleImage(src, alt);
  };

  return `
  ${contentBlock(content.title, homeSectionBody(`${content.intro}\n${config.businessDescription}`, config, content.title))}
  ${addImage(content.title)}
  ${content.sections.map((section) => `${contentBlock(section.heading, homeSectionBody(section.body, config, section.heading))}${addImage(section.heading)}`).join("")}`;
};

export const structuredServiceContentToHtml = (content: NonNullable<TemplateContent["servicePages"]>[number], config: WizardConfig, options: RenderImageOptions = {}): string => {
  const imageLimit = config.serviceImageCount === 0 ? 0 : 1;
  const images = (options.generatedImages?.length ? options.generatedImages : sharedImagePool({ ...config, serviceImageCount: 1 }, options)).slice(0, imageLimit);
  let insertedImages = 0;
  const addImage = (alt: string): string => {
    if (insertedImages >= imageLimit) {
      return "";
    }
    const src = images[insertedImages % images.length];
    if (!src) {
      return "";
    }
    insertedImages += 1;
    return articleImage(src, alt);
  };

  return `
  ${contentBlock(content.title, serviceSectionBody(content.intro, config, content.keyword))}
  ${addImage(content.title)}
  ${content.sections.map((section) => `${contentBlock(section.heading, serviceSectionBody(section.body, config, content.keyword))}${addImage(section.heading)}`).join("")}`;
};

export const structuredAboutContentToHtml = (content: TemplateContent["about"], config: WizardConfig): string => {
  const headings = [
    content.title,
    `Welcome to ${config.businessName}`,
    `Why We Created ${config.businessName}`,
    "Our Mission",
    "A Platform Built Around Personalization",
    "Supporting Creativity and Open-Ended Conversation",
    "Our Approach to Privacy and Responsible Use",
    "Our Vision for the Future",
    `Start Exploring ${config.businessName}`
  ];
  const descriptions = content.description.length ? content.description : [config.businessDescription];
  return headings
    .map((heading, index) => {
      const body = aboutSectionBody(descriptions[index] ?? descriptions[descriptions.length - 1] ?? config.businessDescription, config);
      const image = index === 0 ? articleImage("hero-chat.png", heading) : index % 3 === 0 ? articleImage("creative-storytelling.png", heading) : "";
      return `${contentBlock(heading, body)}${image}`;
    })
    .join("");
};

export const createFallbackTemplateContent = (config: WizardConfig): TemplateContent => {
  const inferredTerms = inferBusinessTerms(config);
  const serviceKeywordGroups = configuredServiceKeywordGroups(config);
  const configuredServiceKeywords = uniqueNonEmpty(serviceKeywordGroups.map((group) => group[0]));
  const serviceKeywords = configuredServiceKeywords.length
    ? configuredServiceKeywords
    : uniqueNonEmpty([config.dropdownLabel, inferredTerms[0], config.industry]);
  const homeKeywords = configuredHomeKeywords(config);
  const logoMarkup = logoMarkupFor(config);
  const primaryService = serviceKeywords[0] ?? inferredTerms[0] ?? config.industry;
  const customerContext = config.location ? `${config.industry} customers in ${config.location}` : `${config.industry} customers`;
  const canonicalUrl = config.websiteUrl ?? "https://example.com/";
  const serviceTerms = uniqueNonEmpty([...serviceKeywords, ...inferredTerms]);
  const services = Array.from({ length: Math.max(6, serviceKeywords.length) }, (_, index) => {
    const service = pick(serviceTerms, index, primaryService);
    return {
      title: service,
      description: `${config.businessName} provides ${service.toLowerCase()} for ${customerContext.toLowerCase()} with a clear, professional approach.`
    };
  });
  const heroDescription = [
    sentence(config.businessDescription),
    `${config.businessName} helps ${customerContext.toLowerCase()} compare options, understand services, and take the next step with confidence.`
  ];
  const aboutDescription = [
    sentence(config.businessDescription),
    `${config.businessName} was created for people who want a clearer, more flexible, and more useful way to understand ${config.industry.toLowerCase()}. The website explains services in a direct style so visitors can learn what is available and decide which option fits their needs.`,
    `Many websites provide only short summaries, but visitors often need more context before they are ready to act. ${config.businessName} uses longer explanations, practical sections, and direct navigation so users can move from basic understanding to a confident next step.`,
    `Our mission is to make information about ${config.industry.toLowerCase()} easier to understand and easier to use. We want every page to feel helpful, organized, and relevant to the real questions people bring when they search for this type of service.`,
    `Every visitor has different priorities. Some want quick answers, some want detailed explanations, and others want to compare several service options before contacting a provider. ${config.businessName} is structured to support those different reading styles.`,
    `Useful content should not feel like a collection of disconnected paragraphs. It should guide the reader through the topic, explain the value of each service, and make the next action simple. That is the approach behind the pages generated for this website.`,
    `We also believe that clear communication should be paired with responsible expectations. Visitors should review important information, ask questions when needed, and use the contact options to confirm details that matter to their situation.`,
    `Our vision is to keep improving how service information is presented online. As customer expectations change, ${config.businessName} can continue offering pages that are easier to read, easier to navigate, and more useful for people comparing options.`,
    `Start by exploring the services menu, reading the page that matches your interest, and using the contact page when you are ready. ${config.businessName} is designed to make that journey feel simple from the first visit.`
  ];
  const homePages = Array.from({ length: Math.max(1, Math.min(50, config.pageCount ?? 1)) }, (_, index) => homePageFromKeywords(config, index, homeKeywords));
  const servicePages = serviceKeywordGroups.flatMap((group) => group.map((keyword) => servicePageFromKeyword(config, keyword, group)));
  const homeContent = structuredHomeContentToHtml(homePages[0] ?? homePageFromKeywords(config, 0, homeKeywords), config);
  const servicesContent = structuredServiceContentToHtml(servicePages[0] ?? servicePageFromKeyword(config, primaryService, [primaryService]), config);
  const aboutContent = structuredAboutContentToHtml({ title: `About ${config.businessName}`, description: aboutDescription }, config);
  const contactMode = config.contactMode ?? "form";
  const selectedMapEmbedCode = userProvidedEmbed(config.mapEmbedCode);
  const selectedContactMapEmbedCode = userProvidedEmbed(config.contactMapEmbedCode) || selectedMapEmbedCode;
  const contactContentBase: TemplateContent = {
    businessName: config.businessName,
    logoMarkup,
    tagline: "",
    primaryCta: "",
    canonicalUrl,
    dropdownLabel: primaryService,
    serviceKeywords,
    youtubeEmbedCode: "",
    googleDocsEmbedCode: "",
    googlePresentationEmbedCode: "",
    googleSheetsEmbedCode: "",
    mapEmbedCode: "",
    contactMapEmbedCode: "",
    socialLinks: [],
    contact: {
      phone: config.contactPhone,
      email: config.contactEmail,
      address: config.contactAddress ?? config.location,
      hours: config.contactHours,
      websiteUrl: config.websiteUrl
    },
    hero: { title: "", subtitle: "", description: [] },
    about: { title: "", description: [] },
    services: [],
    features: [],
    testimonials: [],
    faq: [],
    seo: { title: "", metaDescription: "", openGraphTitle: "", openGraphDescription: "", twitterTitle: "", twitterDescription: "", schema: {} },
    homePages: [],
    servicePages: [],
    pageContent: { home: "", services: "", about: "", contact: "" }
  };
  const contactBody = contactMode === "form-map"
    ? `<div class="contact-wrap"><div class="contact-layout">${contactForm(config.businessName, config.contactEmail)}${contactMap(selectedContactMapEmbedCode)}</div></div>`
    : contactMode === "details-map"
      ? `<div class="contact-wrap"><div class="contact-layout">${contactDetails(contactContentBase)}${contactMap(selectedContactMapEmbedCode)}</div></div>`
      : contactMode === "details"
        ? `<div class="contact-wrap details-only">${contactDetails(contactContentBase)}</div>`
        : `<div class="contact-wrap">${contactForm(config.businessName, config.contactEmail)}</div>`;
  const contactContent = `
  <div class="page active" id="page-contact">
    <div class="page-hero"><h1>Contact Us</h1></div>
    ${contactBody}
  </div>`;

  return {
    businessName: config.businessName,
    logoMarkup,
    tagline: `${config.industry} for ${customerContext}`,
    primaryCta: "Get Started",
    secondaryCta: "Learn More",
    canonicalUrl,
    dropdownLabel: serviceKeywords[0] ?? services[0]?.title ?? primaryService,
    serviceKeywords,
    youtubeEmbedCode: userProvidedEmbed(config.youtubeEmbedCode),
    googleDocsEmbedCode: userProvidedEmbed(config.googleDocsEmbedCode),
    googlePresentationEmbedCode: userProvidedEmbed(config.googlePresentationEmbedCode),
    googleSheetsEmbedCode: userProvidedEmbed(config.googleSheetsEmbedCode),
    mapEmbedCode: selectedMapEmbedCode,
    contactMapEmbedCode: selectedContactMapEmbedCode,
    socialLinks: configuredSocialLinks(config),
    contact: {
      phone: config.contactPhone,
      email: config.contactEmail,
      address: config.contactAddress ?? config.location,
      hours: config.contactHours,
      websiteUrl: config.websiteUrl
    },
    hero: {
      title: `${config.businessName}: ${primaryService}`,
      subtitle: config.businessDescription,
      description: heroDescription
    },
    about: {
      title: `About ${config.businessName}`,
      description: aboutDescription
    },
    services,
    features: services.slice(0, 3),
    testimonials: [
      { quote: `${config.businessName} made the process clear and easy to understand.`, name: "Client" },
      { quote: "The team was responsive, organized, and helpful from start to finish.", name: "Customer" }
    ],
    faq: [
      {
        question: `What does ${config.businessName} offer?`,
        answer: `${config.businessName} offers ${inferredTerms.join(", ") || primaryService}.`
      },
      {
        question: "How can I get started?",
        answer: config.contactEmail ? `Contact the team at ${config.contactEmail}.` : "Use the contact form to send your requirements."
      },
      {
        question: "Where do you provide services?",
        answer: config.location ? `Services are available in ${config.location}.` : "Services are available for the listed target audience."
      },
      {
        question: "Can I ask about a specific service?",
        answer: `Yes. Choose a service from the menu or contact ${config.businessName} with your exact requirement.`
      },
      {
        question: "How quickly can I receive a response?",
        answer: config.contactEmail || config.contactPhone ? "The team will respond using the contact details provided on this website." : "Send a message through the contact page and the team will respond as soon as possible."
      }
    ],
    seo: {
      title: `${config.businessName} | ${primaryService}`,
      metaDescription: sentence(config.businessDescription).slice(0, 155),
      openGraphTitle: `${config.businessName} | ${primaryService}`,
      openGraphDescription: sentence(config.businessDescription).slice(0, 200),
      twitterTitle: `${config.businessName} | ${primaryService}`,
      twitterDescription: sentence(config.businessDescription).slice(0, 200),
      schema: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: config.businessName,
        description: config.businessDescription,
      email: config.contactEmail,
      telephone: config.contactPhone,
      address: config.location,
        url: config.websiteUrl
      }
    },
    homePages,
    servicePages,
    pageContent: {
      home: homeContent,
      services: servicesContent,
      about: aboutContent,
      contact: contactContent
    }
  };
};

export const flattenTemplateContent = (content: TemplateContent): Record<string, PlaceholderValue> => {
  const values: Record<string, PlaceholderValue> = {
    BUSINESS_NAME: content.businessName,
    LOGO_MARKUP: content.logoMarkup,
    TAGLINE: content.tagline,
    FOOTER_DESCRIPTION: footerDescription(content),
    PRIMARY_CTA: content.primaryCta,
    SECONDARY_CTA: content.secondaryCta,
    CANONICAL_URL: content.canonicalUrl,
    DROPDOWN_LABEL: content.dropdownLabel,
    SERVICES_NAV_ITEMS: servicesNavItems(content.serviceKeywords.length ? content.serviceKeywords : [content.dropdownLabel]),
    SERVICES_INDEX_URL: serviceKeywordToFileName(content.serviceKeywords[0] ?? content.dropdownLabel),
    YOUTUBE_EMBED: content.youtubeEmbedCode,
    GOOGLE_DOCS_EMBED: content.googleDocsEmbedCode,
    GOOGLE_PRESENTATION_EMBED: content.googlePresentationEmbedCode,
    GOOGLE_SHEETS_EMBED: content.googleSheetsEmbedCode,
    YOUTUBE_SECTION: homeVideoSection(content.youtubeEmbedCode),
    HOME_MAP_EMBED: homeEmbedCard("Location Map", content.contactMapEmbedCode || content.mapEmbedCode, "home-map-card"),
    HOME_EMBEDS: homeEmbedCluster(content),
    SOCIAL_LINKS: socialLinksMarkup(content.socialLinks),
    SOCIAL_SECTION: socialSectionMarkup(content.socialLinks),
    PHONE: content.contact.phone,
    EMAIL: content.contact.email,
    ADDRESS: content.contact.address,
    HERO_TITLE: content.hero.title,
    HERO_SUBTITLE: content.hero.subtitle,
    HERO_DESCRIPTION: content.hero.description.join("\n\n"),
    HERO_DESCRIPTION_1: content.hero.description[0],
    HERO_DESCRIPTION_2: content.hero.description[1],
    ABOUT_TITLE: content.about.title,
    ABOUT_DESCRIPTION: content.about.description.join("\n\n"),
    ABOUT_DESCRIPTION_1: content.about.description[0],
    ABOUT_DESCRIPTION_2: content.about.description[1],
    META_TITLE: content.seo.title,
    META_DESCRIPTION: content.seo.metaDescription,
    OG_TITLE: content.seo.openGraphTitle,
    OG_DESCRIPTION: content.seo.openGraphDescription,
    TWITTER_TITLE: content.seo.twitterTitle,
    TWITTER_DESCRIPTION: content.seo.twitterDescription,
    SCHEMA: JSON.stringify(content.seo.schema),
    HOME_CONTENT: content.pageContent.home,
    SERVICES_CONTENT: content.pageContent.services,
    ABOUT_CONTENT: content.pageContent.about,
    CONTACT_CONTENT: content.pageContent.contact
  };

  for (let index = 0; index < 20; index += 1) {
    const service = content.services[index] ?? content.services[content.services.length - 1];
    values[`SERVICE_${index + 1}_TITLE`] = service?.title;
    values[`SERVICE_${index + 1}_DESCRIPTION`] = service?.description;
    const feature = content.features[index] ?? content.features[content.features.length - 1];
    values[`FEATURE_${index + 1}_TITLE`] = feature?.title;
    values[`FEATURE_${index + 1}_DESCRIPTION`] = feature?.description;
    const faq = content.faq[index] ?? content.faq[content.faq.length - 1];
    values[`FAQ_${index + 1}_QUESTION`] = faq?.question;
    values[`FAQ_${index + 1}_ANSWER`] = faq?.answer;
    const testimonial = content.testimonials[index] ?? content.testimonials[content.testimonials.length - 1];
    values[`TESTIMONIAL_${index + 1}_QUOTE`] = testimonial?.quote;
    values[`TESTIMONIAL_${index + 1}_NAME`] = testimonial?.name;
  }

  return values;
};
