import type { AiProvider } from "@forgeseo/shared";

export interface AiProviderSettings {
  apiKey: string;
  model: string;
}

export interface AiSettings {
  selectedProvider: AiProvider;
  providers: Record<AiProvider, AiProviderSettings>;
}

export interface IntegrationDefinition {
  id: AiProvider | "google-search-console" | "google-analytics" | "firebase" | "github" | "google-drive" | "cloudflare";
  name: string;
  category: "AI" | "Analytics" | "Deployment" | "VCS" | "Storage";
  description: string;
  authType: "API Key" | "OAuth 2.0";
  popular?: boolean;
  generationProvider?: AiProvider;
  defaultModel?: string;
}

const settingsKey = "forgeseo.aiSettings";

export const aiProviderDefaults: Record<AiProvider, string> = {
  openai: "gpt-5-mini",
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-5",
  openrouter: "openai/gpt-5-mini",
  perplexity: "sonar-pro",
  xai: "grok-4",
  groq: "llama-3.3-70b-versatile",
  mistral: "mistral-large-latest",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo"
};

export const integrationCatalog: IntegrationDefinition[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    category: "AI",
    description: "Google AI models",
    authType: "API Key",
    popular: true,
    generationProvider: "gemini",
    defaultModel: aiProviderDefaults.gemini
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "AI",
    description: "GPT and related models",
    authType: "API Key",
    popular: true,
    generationProvider: "openai",
    defaultModel: aiProviderDefaults.openai
  },
  {
    id: "google-search-console",
    name: "Google Search Console",
    category: "Analytics",
    description: "Search metrics",
    authType: "OAuth 2.0",
    popular: true
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    category: "Analytics",
    description: "Web traffic analytics",
    authType: "OAuth 2.0",
    popular: true
  },
  {
    id: "firebase",
    name: "Firebase",
    category: "Deployment",
    description: "Backend and hosting",
    authType: "OAuth 2.0",
    popular: true
  },
  {
    id: "github",
    name: "GitHub",
    category: "VCS",
    description: "Version control",
    authType: "OAuth 2.0",
    popular: true
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "Storage",
    description: "Document storage",
    authType: "OAuth 2.0",
    popular: true
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "AI",
    description: "Claude models",
    authType: "API Key",
    generationProvider: "anthropic",
    defaultModel: aiProviderDefaults.anthropic
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "Deployment",
    description: "Edge network",
    authType: "API Key"
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "AI",
    description: "Multi-model AI routing",
    authType: "API Key",
    popular: true,
    generationProvider: "openrouter",
    defaultModel: aiProviderDefaults.openrouter
  },
  {
    id: "perplexity",
    name: "Perplexity",
    category: "AI",
    description: "Answer and research models",
    authType: "API Key",
    generationProvider: "perplexity",
    defaultModel: aiProviderDefaults.perplexity
  },
  {
    id: "xai",
    name: "xAI Grok",
    category: "AI",
    description: "Grok models",
    authType: "API Key",
    generationProvider: "xai",
    defaultModel: aiProviderDefaults.xai
  },
  {
    id: "groq",
    name: "Groq",
    category: "AI",
    description: "Fast open models",
    authType: "API Key",
    generationProvider: "groq",
    defaultModel: aiProviderDefaults.groq
  },
  {
    id: "mistral",
    name: "Mistral AI",
    category: "AI",
    description: "Mistral language models",
    authType: "API Key",
    generationProvider: "mistral",
    defaultModel: aiProviderDefaults.mistral
  },
  {
    id: "together",
    name: "Together AI",
    category: "AI",
    description: "Open model hosting",
    authType: "API Key",
    generationProvider: "together",
    defaultModel: aiProviderDefaults.together
  }
];

const defaultProviders = (): Record<AiProvider, AiProviderSettings> => ({
  openai: { apiKey: "", model: aiProviderDefaults.openai },
  gemini: { apiKey: "", model: aiProviderDefaults.gemini },
  anthropic: { apiKey: "", model: aiProviderDefaults.anthropic },
  openrouter: { apiKey: "", model: aiProviderDefaults.openrouter },
  perplexity: { apiKey: "", model: aiProviderDefaults.perplexity },
  xai: { apiKey: "", model: aiProviderDefaults.xai },
  groq: { apiKey: "", model: aiProviderDefaults.groq },
  mistral: { apiKey: "", model: aiProviderDefaults.mistral },
  together: { apiKey: "", model: aiProviderDefaults.together }
});

export const defaultAiSettings: AiSettings = {
  selectedProvider: "openai",
  providers: defaultProviders()
};

const normalizeSettings = (parsed: Partial<AiSettings> & { openAiApiKey?: string; openAiModel?: string }): AiSettings => {
  const providers = defaultProviders();
  for (const provider of Object.keys(providers) as AiProvider[]) {
    providers[provider] = {
      apiKey: parsed.providers?.[provider]?.apiKey?.trim() ?? "",
      model: parsed.providers?.[provider]?.model?.trim() || providers[provider].model
    };
  }

  if (parsed.openAiApiKey || parsed.openAiModel) {
    providers.openai = {
      apiKey: parsed.openAiApiKey?.trim() ?? providers.openai.apiKey,
      model: parsed.openAiModel?.trim() || providers.openai.model
    };
  }

  const selectedProvider = parsed.selectedProvider && parsed.selectedProvider in providers ? parsed.selectedProvider : "openai";
  return { selectedProvider, providers };
};

export const loadAiSettings = (): AiSettings => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(settingsKey) ?? "{}") as Partial<AiSettings> & { openAiApiKey?: string; openAiModel?: string };
    return normalizeSettings(parsed);
  } catch {
    return defaultAiSettings;
  }
};

export const saveAiSettings = (settings: AiSettings): void => {
  window.localStorage.setItem(settingsKey, JSON.stringify({
    selectedProvider: settings.selectedProvider,
    providers: Object.fromEntries(
      (Object.keys(settings.providers) as AiProvider[]).map((provider) => [
        provider,
        {
          apiKey: settings.providers[provider].apiKey.trim(),
          model: settings.providers[provider].model.trim() || aiProviderDefaults[provider]
        }
      ])
    )
  }));
};

export const clearAiSettings = (): void => {
  window.localStorage.removeItem(settingsKey);
};

export const getConnectedProvider = (settings: AiSettings): { provider: AiProvider; apiKey: string; model: string } | undefined => {
  const selected = settings.providers[settings.selectedProvider];
  if (selected.apiKey.trim().length < 8) {
    return undefined;
  }
  return {
    provider: settings.selectedProvider,
    apiKey: selected.apiKey.trim(),
    model: selected.model.trim() || aiProviderDefaults[settings.selectedProvider]
  };
};
