import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Code2, Image as ImageIcon, Link as LinkIcon, LayoutTemplate, ListTree, Plus, Share2, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import { buildImageRequirements, type ContactMode, type ImageSourceMode, type ProjectWizardConfig, type SocialPlatform, type WebsitePageKind } from "@forgeseo/shared";
import { getTemplates, startGeneration } from "../services/api";
import { getConnectedProvider, integrationCatalog, loadAiSettings } from "../services/settings";

interface WizardFormState {
  pageCount: string;
  businessName: string;
  businessDescription: string;
  industry: string;
  customLogoEnabled: boolean;
  logoDataUrl: string;
  logoFileName: string;
  logoError: string;
  homePageKeywords: string;
  homeImageCount: string;
  imageSourceMode: ImageSourceMode;
  imageUrls: Record<string, string>;
  location: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactHours: string;
  contactMode: ContactMode;
  mapEmbedCode: string;
  contactMapEmbedCode: string;
  websiteUrl: string;
  serviceKeywordGroups: string[][];
  youtubeEmbedCode: string;
  googleDocsEmbedCode: string;
  googlePresentationEmbedCode: string;
  googleSheetsEmbedCode: string;
  socialLinks: Record<SocialPlatform, { enabled: boolean; url: string }>;
  anchorLinks: Array<{ text: string; url: string }>;
  selectedPages: WebsitePageKind[];
}

const socialOptions: Array<{ platform: SocialPlatform; label: string; placeholder: string }> = [
  { platform: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/..." },
  { platform: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
  { platform: "x", label: "X", placeholder: "https://x.com/..." },
  { platform: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
  { platform: "youtube", label: "YouTube", placeholder: "https://youtube.com/..." }
];

const initialForm: WizardFormState = {
  pageCount: "1",
  businessName: "",
  businessDescription: "",
  industry: "",
  customLogoEnabled: false,
  logoDataUrl: "",
  logoFileName: "",
  logoError: "",
  homePageKeywords: "",
  homeImageCount: "3",
  imageSourceMode: "forge",
  imageUrls: {},
  location: "",
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  contactHours: "",
  contactMode: "form",
  mapEmbedCode: "",
  contactMapEmbedCode: "",
  websiteUrl: "",
  serviceKeywordGroups: [[""]],
  youtubeEmbedCode: "",
  googleDocsEmbedCode: "",
  googlePresentationEmbedCode: "",
  googleSheetsEmbedCode: "",
  socialLinks: {
    linkedin: { enabled: false, url: "" },
    instagram: { enabled: false, url: "" },
    x: { enabled: false, url: "" },
    facebook: { enabled: false, url: "" },
    youtube: { enabled: false, url: "" }
  },
  anchorLinks: [{ text: "", url: "" }],
  selectedPages: ["home", "services", "about", "contact"]
};

export const ProjectWizard = (): ReactElement => {
  const navigate = useNavigate();
  const [form, setForm] = useState<WizardFormState>(initialForm);
  const templatesQuery = useQuery({ queryKey: ["templates"], queryFn: getTemplates });
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [aiSettings, setAiSettings] = useState(loadAiSettings);

  useEffect(() => {
    if (selectedTemplateIds.length === 0 && templatesQuery.data?.length) {
      setSelectedTemplateIds(templatesQuery.data.map((template) => template.id));
    }
  }, [selectedTemplateIds.length, templatesQuery.data]);

  const mutation = useMutation({
    mutationFn: startGeneration,
    onSuccess: (result) => navigate(`/jobs/${result.jobId}`)
  });

  useEffect(() => {
    const refreshSettings = (): void => setAiSettings(loadAiSettings());
    window.addEventListener("focus", refreshSettings);
    return () => window.removeEventListener("focus", refreshSettings);
  }, []);

  const update = <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateSocialLink = (platform: SocialPlatform, value: Partial<WizardFormState["socialLinks"][SocialPlatform]>): void => {
    setForm((current) => ({
      ...current,
      socialLinks: {
        ...current.socialLinks,
        [platform]: {
          ...current.socialLinks[platform],
          ...value
        }
      }
    }));
  };

  useEffect(() => {
    const pageCount = Math.max(1, Math.min(50, Number(form.pageCount) || 1));
    setForm((current) => {
      if (current.serviceKeywordGroups.length === pageCount) {
        return current;
      }
      const nextGroups = Array.from({ length: pageCount }, (_, index) => current.serviceKeywordGroups[index] ?? [""]);
      return { ...current, serviceKeywordGroups: nextGroups };
    });
  }, [form.pageCount]);

  const updateAnchorLink = (index: number, key: "text" | "url", value: string): void => {
    setForm((current) => ({
      ...current,
      anchorLinks: current.anchorLinks.map((anchor, anchorIndex) => (anchorIndex === index ? { ...anchor, [key]: value } : anchor))
    }));
  };

  const addAnchorLink = (): void => {
    setForm((current) => ({ ...current, anchorLinks: [...current.anchorLinks, { text: "", url: "" }] }));
  };

  const removeAnchorLink = (index: number): void => {
    setForm((current) => ({
      ...current,
      anchorLinks: current.anchorLinks.length === 1 ? [{ text: "", url: "" }] : current.anchorLinks.filter((_, anchorIndex) => anchorIndex !== index)
    }));
  };

  const handleLogoFile = (file: File | undefined): void => {
    if (!file) {
      setForm((current) => ({ ...current, logoDataUrl: "", logoFileName: "", logoError: "" }));
      return;
    }
    const allowedTypes = new Set(["image/png", "image/svg+xml"]);
    const maxSizeBytes = 5_000_000;
    if (!allowedTypes.has(file.type)) {
      setForm((current) => ({ ...current, logoDataUrl: "", logoFileName: "", logoError: "Upload a PNG or SVG logo." }));
      return;
    }
    if (file.size > maxSizeBytes) {
      setForm((current) => ({ ...current, logoDataUrl: "", logoFileName: "", logoError: "Logo must be 5 MB or smaller." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((current) => ({ ...current, logoDataUrl: result, logoFileName: file.name, logoError: "" }));
    };
    reader.onerror = () => {
      setForm((current) => ({ ...current, logoDataUrl: "", logoFileName: "", logoError: "Could not read that logo file." }));
    };
    reader.readAsDataURL(file);
  };

  const updateServiceKeyword = (groupIndex: number, keywordIndex: number, value: string): void => {
    setForm((current) => ({
      ...current,
      serviceKeywordGroups: current.serviceKeywordGroups.map((group, currentGroupIndex) => (
        currentGroupIndex === groupIndex
          ? group.map((keyword, currentKeywordIndex) => (currentKeywordIndex === keywordIndex ? value : keyword))
          : group
      ))
    }));
  };

  const addServiceKeyword = (groupIndex: number): void => {
    setForm((current) => ({
      ...current,
      serviceKeywordGroups: current.serviceKeywordGroups.map((group, currentGroupIndex) => (
        currentGroupIndex === groupIndex && group.length < 10 ? [...group, ""] : group
      ))
    }));
  };

  const removeServiceKeyword = (groupIndex: number, keywordIndex: number): void => {
    setForm((current) => ({
      ...current,
      serviceKeywordGroups: current.serviceKeywordGroups.map((group, currentGroupIndex) => (
        currentGroupIndex === groupIndex
          ? group.length === 1 ? [""] : group.filter((_, currentKeywordIndex) => currentKeywordIndex !== keywordIndex)
          : group
      ))
    }));
  };

  const toggleTemplate = (templateId: string): void => {
    setSelectedTemplateIds((current) => (
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId]
    ));
  };

  const togglePage = (page: WebsitePageKind): void => {
    if (page === "home") {
      return;
    }
    setForm((current) => {
      const pages = current.selectedPages.includes(page)
        ? current.selectedPages.filter((item) => item !== page)
        : [...current.selectedPages, page];
      return { ...current, selectedPages: Array.from(new Set(["home", ...pages])) };
    });
  };

  const homePageKeywords = form.homePageKeywords
    .split(/[\n,]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  const serviceKeywordGroups = form.serviceKeywordGroups.map((group) => group.map((keyword) => keyword.trim()).filter(Boolean));
  const serviceKeywords = serviceKeywordGroups.reduce<string[]>((keywords, group) => {
    if (group[0]) {
      keywords.push(group[0]);
    }
    return keywords;
  }, []);
  const serviceKeywordGroupsAreComplete = serviceKeywordGroups.length > 0 && serviceKeywordGroups.every((group) => group.length > 0);
  const socialLinks = socialOptions
    .map(({ platform }) => ({ platform, url: form.socialLinks[platform].url.trim(), enabled: form.socialLinks[platform].enabled }))
    .filter((social) => social.enabled && social.url)
    .map(({ platform, url }) => ({ platform, url }));
  const contactModeUsesDetails = form.contactMode === "details" || form.contactMode === "details-map";
  const contactModeUsesMap = form.contactMode === "form-map" || form.contactMode === "details-map";
  const connectedProvider = getConnectedProvider(aiSettings);
  const connectedOpenAiSettings = aiSettings.providers.openai.apiKey.trim().length >= 8 ? aiSettings.providers.openai : undefined;
  const selectedProviderName = integrationCatalog.find((integration) => integration.generationProvider === aiSettings.selectedProvider)?.name ?? "AI provider";

  const wizardConfig: ProjectWizardConfig = {
    templateId: selectedTemplateIds[0],
    templateIds: selectedTemplateIds,
    pageCount: Number(form.pageCount) || 1,
    businessName: form.businessName,
    businessDescription: form.businessDescription,
    industry: form.industry,
    customLogoEnabled: form.customLogoEnabled,
    logoDataUrl: form.customLogoEnabled && form.logoDataUrl ? form.logoDataUrl : undefined,
    logoFileName: form.customLogoEnabled && form.logoFileName ? form.logoFileName : undefined,
    homePageKeywords: homePageKeywords.length ? homePageKeywords : undefined,
    homeImageCount: Number(form.homeImageCount) || 0,
    serviceImageCount: form.selectedPages.includes("services") ? 1 : 0,
    imageSourceMode: form.imageSourceMode,
    location: form.location || undefined,
    contactEmail: form.contactEmail || undefined,
    contactPhone: form.contactPhone || undefined,
    contactAddress: form.contactAddress || form.location || undefined,
    contactHours: form.contactHours || undefined,
    contactMode: form.contactMode,
    mapEmbedCode: form.mapEmbedCode || undefined,
    contactMapEmbedCode: form.contactMapEmbedCode || undefined,
    websiteUrl: form.websiteUrl || undefined,
    dropdownLabel: serviceKeywords[0] || undefined,
    serviceKeywords: serviceKeywords.length ? serviceKeywords : undefined,
    serviceKeywordGroups: serviceKeywordGroupsAreComplete ? serviceKeywordGroups.map((keywords) => ({ keywords })) : undefined,
    youtubeEmbedCode: form.youtubeEmbedCode || undefined,
    googleDocsEmbedCode: form.googleDocsEmbedCode || undefined,
    googlePresentationEmbedCode: form.googlePresentationEmbedCode || undefined,
    googleSheetsEmbedCode: form.googleSheetsEmbedCode || undefined,
    socialLinks: socialLinks.length ? socialLinks : undefined,
    selectedPages: form.selectedPages,
    anchorLinks: form.anchorLinks
      .map((anchor) => ({ text: anchor.text.trim(), url: anchor.url.trim() }))
      .filter((anchor) => anchor.text && anchor.url)
  };
  const imageRequirements = buildImageRequirements(wizardConfig);
  const imageUrlsAreComplete = form.imageSourceMode !== "url" || imageRequirements.every((requirement) => form.imageUrls[requirement.id]?.trim());
  const updateImageUrl = (requirementId: string, url: string): void => {
    setForm((current) => ({
      ...current,
      imageUrls: {
        ...current.imageUrls,
        [requirementId]: url
      }
    }));
  };
  const wizardConfigWithImageUrls: ProjectWizardConfig = {
    ...wizardConfig,
    imageUrls: form.imageSourceMode === "url"
      ? imageRequirements
          .map((requirement) => ({ requirementId: requirement.id, url: form.imageUrls[requirement.id]?.trim() ?? "" }))
          .filter((item) => item.url)
      : undefined
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-ocean">Template Rendering Engine</p>
        <h1 className="text-3xl font-semibold text-ink">Create a website from business basics</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Business info goes in, structured JSON is created, the renderer fills the selected premium template, and the finished site opens in preview.
        </p>
      </div>

      <form
        className="mt-7 grid gap-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedTemplateIds.length === 0 || homePageKeywords.length === 0 || !serviceKeywordGroupsAreComplete || !connectedProvider || !imageUrlsAreComplete) {
            return;
          }
          mutation.mutate({
            wizardConfig: wizardConfigWithImageUrls,
            aiProvider: connectedProvider.provider,
            aiApiKey: connectedProvider.apiKey,
            aiModel: connectedProvider.model,
            openAiApiKey: connectedOpenAiSettings?.apiKey.trim(),
            openAiModel: connectedOpenAiSettings?.model.trim()
          });
        }}
      >
        <section className="grid gap-4 rounded border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Business Info</h2>
            <p className="mt-1 text-sm text-slate-500">Only the essentials. ForgeSEO infers the rest.</p>
          </div>
          <input required className="rounded border border-slate-300 px-3 py-2" placeholder="Business name" value={form.businessName} onChange={(event) => update("businessName", event.target.value)} />
          <textarea required className="min-h-32 rounded border border-slate-300 px-3 py-2" placeholder="Describe what the business does, who it helps, and what makes it useful." value={form.businessDescription} onChange={(event) => update("businessDescription", event.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <input required className="rounded border border-slate-300 px-3 py-2" placeholder="Industry" value={form.industry} onChange={(event) => update("industry", event.target.value)} />
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="Location" value={form.location} onChange={(event) => update("location", event.target.value)} />
          </div>
          <div className="grid gap-3 rounded border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-3 text-sm font-semibold text-ink">
                <ImageIcon className="h-4 w-4 text-ocean" />
                Use custom logo
              </span>
              <input type="checkbox" checked={form.customLogoEnabled} onChange={(event) => update("customLogoEnabled", event.target.checked)} />
            </label>
            {form.customLogoEnabled ? (
              <div className="grid gap-2">
                <input
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  type="file"
                  accept="image/png,image/svg+xml"
                  onChange={(event) => handleLogoFile(event.target.files?.[0])}
                />
                <p className="text-xs text-slate-500">PNG or SVG, up to 5 MB. If no file is uploaded, the business name is used as the logo text.</p>
                {form.logoFileName ? <p className="text-xs font-semibold text-ocean">{form.logoFileName}</p> : null}
                {form.logoError ? <p className="text-xs font-semibold text-red-600">{form.logoError}</p> : null}
              </div>
            ) : null}
          </div>
          <textarea required className="min-h-24 rounded border border-slate-300 px-3 py-2" placeholder="Home page content keywords. Add one per line, or separate with commas." value={form.homePageKeywords} onChange={(event) => update("homePageKeywords", event.target.value)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <input className="rounded border border-slate-300 px-3 py-2" min="1" max="50" type="number" placeholder="Pages" value={form.pageCount} onChange={(event) => update("pageCount", event.target.value)} />
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Choose the number of images to be added on the home page
              <input className="rounded border border-slate-300 px-3 py-2 text-sm font-normal text-ink" min="0" max="20" type="number" value={form.homeImageCount} onChange={(event) => update("homeImageCount", event.target.value)} />
            </label>
            <input className="rounded border border-slate-300 px-3 py-2" placeholder="Website URL" value={form.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} />
          </div>
          <div className="grid gap-3 rounded border border-slate-200 bg-slate-50 p-4">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Image source
              <select className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-ink" value={form.imageSourceMode} onChange={(event) => update("imageSourceMode", event.target.value as ImageSourceMode)}>
                <option value="forge">ForgeSEO generates images</option>
                <option value="prompt-upload">Show prompts and upload images manually</option>
                <option value="url">Use image URLs</option>
              </select>
            </label>
            <p className="text-sm text-slate-500">
              Home pages receive different images per generated page. Every service page receives one unique image at the start of that service page.
            </p>
            {form.imageSourceMode === "url" ? (
              <div className="grid gap-3">
                {imageRequirements.map((requirement) => (
                  <label key={requirement.id} className="grid gap-1 text-xs font-semibold text-slate-600">
                    {requirement.label}
                    <input className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-ink" placeholder="https://..." value={form.imageUrls[requirement.id] ?? ""} onChange={(event) => updateImageUrl(requirement.id, event.target.value)} />
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 rounded border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Pages Included</h2>
            <p className="mt-1 text-sm text-slate-500">Home is always included. Turn off pages that should not appear in the files, menu, or footer.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { kind: "home" as const, label: "Home", disabled: true },
              { kind: "services" as const, label: "Services" },
              { kind: "about" as const, label: "About Us" },
              { kind: "contact" as const, label: "Contact Us" }
            ].map((page) => (
              <label key={page.kind} className={`flex items-center gap-3 rounded border border-slate-200 px-3 py-2 text-sm ${page.disabled ? "bg-slate-50 text-slate-500" : "bg-white text-slate-700"}`}>
                <input
                  type="checkbox"
                  checked={form.selectedPages.includes(page.kind)}
                  disabled={page.disabled}
                  onChange={() => togglePage(page.kind)}
                />
                <span>{page.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="grid gap-4 rounded border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <ListTree className="h-5 w-5 text-ocean" />
            <div>
              <h2 className="text-lg font-semibold text-ink">Service Pages</h2>
              <p className="mt-1 text-sm text-slate-500">ForgeSEO creates one service set per generated website. Every keyword inside a set becomes one Services dropdown item and one service page file for that website.</p>
            </div>
          </div>
          <div className="grid gap-3">
            {form.serviceKeywordGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="grid gap-3 rounded border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">Generated page {groupIndex + 1}</p>
                  <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:border-ocean hover:text-ocean disabled:cursor-not-allowed disabled:opacity-50" title="Add service page to this generated website" disabled={group.length >= 10} onClick={() => addServiceKeyword(groupIndex)}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {group.map((keyword, keywordIndex) => (
                  <div key={keywordIndex} className="grid gap-3 sm:grid-cols-[1fr_40px]">
                    <input required className="rounded border border-slate-300 px-3 py-2" placeholder={keywordIndex === 0 ? "Service dropdown item and page keyword" : "Another service dropdown item and page keyword"} value={keyword} onChange={(event) => updateServiceKeyword(groupIndex, keywordIndex, event.target.value)} />
                    <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:border-red-300 hover:text-red-600" title="Remove service page keyword" onClick={() => removeServiceKeyword(groupIndex, keywordIndex)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Increase or decrease the Pages field above to change how many service keyword groups are shown.
          </p>
        </section>

        <section className="grid gap-4 rounded border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Contact Page</h2>
            <p className="mt-1 text-sm text-slate-500">Choose the contact layout and fill only the details needed for that layout.</p>
          </div>
          <select className="rounded border border-slate-300 px-3 py-2" value={form.contactMode} onChange={(event) => update("contactMode", event.target.value as ContactMode)}>
            <option value="form-map">Form + map</option>
            <option value="form">Form</option>
            <option value="details-map">Contact details + map</option>
            <option value="details">Contact details</option>
          </select>
          {contactModeUsesDetails ? (
            <div className="grid gap-4 rounded border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <input className="rounded border border-slate-300 px-3 py-2" placeholder="Contact email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} />
              <input className="rounded border border-slate-300 px-3 py-2" placeholder="Contact phone" value={form.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} />
              <textarea className="min-h-20 rounded border border-slate-300 px-3 py-2" placeholder={"Address line 1\nAddress line 2"} value={form.contactAddress} onChange={(event) => update("contactAddress", event.target.value)} />
              <textarea className="min-h-20 rounded border border-slate-300 px-3 py-2" placeholder={"Mon-Fri: 9 AM - 6 PM\nSat: 10 AM - 2 PM"} value={form.contactHours} onChange={(event) => update("contactHours", event.target.value)} />
            </div>
          ) : null}
          {contactModeUsesMap ? (
            <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">The larger contact map iframe from Embeds is used for this contact layout.</p>
          ) : null}
        </section>

        <section className="grid gap-4 rounded border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Code2 className="h-5 w-5 text-ocean" />
            <div>
              <h2 className="text-lg font-semibold text-ink">Embeds</h2>
              <p className="mt-1 text-sm text-slate-500">Paste iframe embed codes for the media sections.</p>
            </div>
          </div>
          <textarea className="min-h-24 rounded border border-slate-300 px-3 py-2 font-mono text-sm" placeholder="YouTube iframe embed code" value={form.youtubeEmbedCode} onChange={(event) => update("youtubeEmbedCode", event.target.value)} />
          <div className="grid gap-4 lg:grid-cols-2">
            <textarea className="min-h-28 rounded border border-slate-300 px-3 py-2 font-mono text-sm" placeholder="Google Docs iframe embed code" value={form.googleDocsEmbedCode} onChange={(event) => update("googleDocsEmbedCode", event.target.value)} />
            <textarea className="min-h-28 rounded border border-slate-300 px-3 py-2 font-mono text-sm" placeholder="Google Presentation iframe embed code" value={form.googlePresentationEmbedCode} onChange={(event) => update("googlePresentationEmbedCode", event.target.value)} />
            <textarea className="min-h-28 rounded border border-slate-300 px-3 py-2 font-mono text-sm" placeholder="Google Sheets iframe embed code" value={form.googleSheetsEmbedCode} onChange={(event) => update("googleSheetsEmbedCode", event.target.value)} />
            <textarea className="min-h-28 rounded border border-slate-300 px-3 py-2 font-mono text-sm" placeholder="Home embed grid Google Maps iframe code" value={form.mapEmbedCode} onChange={(event) => update("mapEmbedCode", event.target.value)} />
          </div>
          <textarea className="min-h-32 rounded border border-slate-300 px-3 py-2 font-mono text-sm" placeholder="Large home map and Contact Us page Google Maps iframe code" value={form.contactMapEmbedCode} onChange={(event) => update("contactMapEmbedCode", event.target.value)} />
        </section>

        <section className="grid gap-4 rounded border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Share2 className="h-5 w-5 text-ocean" />
            <div>
              <h2 className="text-lg font-semibold text-ink">Socials</h2>
              <p className="mt-1 text-sm text-slate-500">Choose which social links should appear in the website footer.</p>
            </div>
          </div>
          <div className="grid gap-3">
            {socialOptions.map((social) => {
              const current = form.socialLinks[social.platform];
              return (
                <div key={social.platform} className="grid gap-3 rounded border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[180px_1fr] sm:items-center">
                  <label className="inline-flex items-center gap-3 text-sm font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={current.enabled}
                      onChange={(event) => updateSocialLink(social.platform, { enabled: event.target.checked })}
                    />
                    <span>{social.label}</span>
                  </label>
                  <input
                    className="rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={!current.enabled}
                    placeholder={social.placeholder}
                    value={current.url}
                    onChange={(event) => updateSocialLink(social.platform, { url: event.target.value })}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 rounded border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <LinkIcon className="h-5 w-5 text-ocean" />
              <div>
                <h2 className="text-lg font-semibold text-ink">Anchor Links</h2>
                <p className="mt-1 text-sm text-slate-500">Each row is inserted once on the home page at the first text match.</p>
              </div>
            </div>
            <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-slate-700 hover:border-ocean hover:text-ocean" title="Add anchor link" onClick={addAnchorLink}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3">
            {form.anchorLinks.map((anchor, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_40px]">
                <input className="rounded border border-slate-300 px-3 py-2" placeholder="Text to anchor" value={anchor.text} onChange={(event) => updateAnchorLink(index, "text", event.target.value)} />
                <input className="rounded border border-slate-300 px-3 py-2" placeholder="Redirect URL" value={anchor.url} onChange={(event) => updateAnchorLink(index, "url", event.target.value)} />
                <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded border border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-600" title="Remove anchor link" onClick={() => removeAnchorLink(index)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <div className="flex items-center gap-3">
            <LayoutTemplate className="h-5 w-5 text-ocean" />
            <div>
              <h2 className="text-lg font-semibold text-ink">Template Library</h2>
              <p className="text-sm text-slate-500">Select one or more templates. Multi-page batches are divided as evenly as possible across the selected templates.</p>
            </div>
          </div>

          {templatesQuery.isLoading ? <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading templates...</p> : null}
          {templatesQuery.error ? <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{templatesQuery.error.message}</p> : null}
          {!templatesQuery.isLoading && !templatesQuery.error && templatesQuery.data?.length === 0 ? <p className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No templates are registered yet.</p> : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templatesQuery.data?.map((template) => {
              const selected = selectedTemplateIds.includes(template.id);
              return (
                <button
                  key={template.id}
                  type="button"
                  className={`overflow-hidden rounded border bg-white text-left transition ${selected ? "border-ocean ring-2 ring-ocean/20" : "border-slate-200 hover:border-ocean/60"}`}
                  onClick={() => toggleTemplate(template.id)}
                >
                  <div className="aspect-video bg-slate-100">
                    {template.previewImageUrl ? <img className="h-full w-full object-cover" src={template.previewImageUrl} alt={`${template.name} preview`} /> : null}
                  </div>
                  <div className="grid gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-ink">{template.name}</h3>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{template.industry}</p>
                      </div>
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${selected ? "bg-ocean text-white" : "bg-slate-100 text-slate-400"}`}>
                        <Check className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="min-h-12 text-sm text-slate-600">{template.style}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {template.colorPalette.slice(0, 5).map((color) => (
                        <span key={color} className="h-5 w-5 rounded-full border border-slate-200" style={{ backgroundColor: color }} title={color} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Pages: {template.pages.join(", ")}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {!connectedProvider ? (
          <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Connect {selectedProviderName} in <Link className="font-semibold text-ocean underline" to="/settings">Settings</Link> before generating.
          </p>
        ) : null}
        {form.imageSourceMode === "url" && !imageUrlsAreComplete ? (
          <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Add an image URL for every listed home and service image requirement.</p>
        ) : null}
        <button disabled={mutation.isPending || selectedTemplateIds.length === 0 || homePageKeywords.length === 0 || !serviceKeywordGroupsAreComplete || !connectedProvider || !imageUrlsAreComplete} className="inline-flex items-center justify-center gap-2 rounded bg-ocean px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400" type="submit">
          {mutation.isPending ? "Creating job..." : "Generate Website"}
          <ArrowRight className="h-4 w-4" />
        </button>
        {mutation.error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{mutation.error.message}</p> : null}
      </form>
    </main>
  );
};
