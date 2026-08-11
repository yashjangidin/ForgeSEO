import type { AiProvider } from "@forgeseo/shared";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Database,
  GitBranch,
  KeyRound,
  ShieldCheck,
  Trash2,
  type LucideIcon
} from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import {
  aiProviderDefaults,
  clearAiSettings,
  defaultAiSettings,
  integrationCatalog,
  loadAiSettings,
  saveAiSettings,
  type IntegrationDefinition
} from "../services/settings";

const iconByCategory: Record<IntegrationDefinition["category"], LucideIcon> = {
  AI: Bot,
  Analytics: BarChart3,
  Deployment: Cloud,
  VCS: GitBranch,
  Storage: Database
};

export const Settings = (): ReactElement => {
  const [settings, setSettings] = useState(loadAiSettings);
  const [activeIntegrationId, setActiveIntegrationId] = useState<string>(settings.selectedProvider);
  const [savedProvider, setSavedProvider] = useState<AiProvider | undefined>();

  const activeIntegration = useMemo(
    () => integrationCatalog.find((integration) => integration.id === activeIntegrationId),
    [activeIntegrationId]
  );
  const activeProvider = activeIntegration?.generationProvider;
  const activeProviderSettings = activeProvider ? settings.providers[activeProvider] : undefined;

  const selectIntegration = (integration: IntegrationDefinition): void => {
    setActiveIntegrationId(integration.id);
    setSavedProvider(undefined);
    if (integration.generationProvider) {
      setSettings((current) => ({ ...current, selectedProvider: integration.generationProvider ?? current.selectedProvider }));
    }
  };

  const updateProvider = (provider: AiProvider, key: "apiKey" | "model", value: string): void => {
    setSavedProvider(undefined);
    setSettings((current) => ({
      ...current,
      selectedProvider: provider,
      providers: {
        ...current.providers,
        [provider]: {
          ...current.providers[provider],
          [key]: value
        }
      }
    }));
  };

  const saveProvider = (provider: AiProvider): void => {
    const nextSettings = { ...settings, selectedProvider: provider };
    saveAiSettings(nextSettings);
    setSettings(nextSettings);
    setSavedProvider(provider);
  };

  const clearProvider = (provider: AiProvider): void => {
    const nextSettings = {
      ...settings,
      providers: {
        ...settings.providers,
        [provider]: {
          apiKey: "",
          model: aiProviderDefaults[provider]
        }
      }
    };
    saveAiSettings(nextSettings);
    setSettings(nextSettings);
    setSavedProvider(undefined);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>ForgeSEO</span>
        <span>/</span>
        <span className="font-semibold text-ink">Integrations</span>
      </div>

      <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {integrationCatalog.map((integration) => {
          const Icon = iconByCategory[integration.category];
          const provider = integration.generationProvider;
          const connected = provider ? settings.providers[provider].apiKey.trim().length >= 8 : false;
          const selected = integration.id === activeIntegrationId || (provider && provider === settings.selectedProvider);
          return (
            <button
              key={integration.id}
              type="button"
              className={`grid min-h-56 gap-4 rounded border bg-white p-5 text-left shadow-sm transition hover:border-ocean/60 ${selected ? "border-ocean ring-2 ring-ocean/15" : "border-slate-200"}`}
              onClick={() => selectIntegration(integration)}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`inline-flex h-14 w-14 items-center justify-center rounded bg-slate-50 ${integration.category === "Analytics" ? "text-amber-500" : "text-ocean"}`}>
                  <Icon className="h-7 w-7" />
                </span>
                {connected ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : integration.popular ? <span className="rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase text-indigo-700">Popular</span> : null}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="line-clamp-1 text-lg font-semibold text-ink">{integration.name}</h2>
                  {connected && integration.popular ? <span className="rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase text-indigo-700">Popular</span> : null}
                </div>
                <p className="mt-1 text-xs font-semibold uppercase text-slate-500">{integration.category}</p>
              </div>

              <p className="text-sm text-slate-600">{integration.description}</p>
              <div className="mt-auto border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-500">
                    {integration.authType === "API Key" ? <KeyRound className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    {integration.authType}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
                    {connected ? "Connected" : provider ? "Connect" : "Coming soon"}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <section className="mt-7 rounded border border-slate-200 bg-white p-5 shadow-sm">
        {activeProvider && activeProviderSettings ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div>
              <h2 className="text-lg font-semibold text-ink">{activeIntegration?.name} API Key</h2>
              <p className="mt-1 text-sm text-slate-500">This provider will be used for structured JSON content generation.</p>
              <input
                className="mt-4 w-full rounded border border-slate-300 px-3 py-2 text-sm text-ink"
                placeholder="Paste API key"
                type="password"
                value={activeProviderSettings.apiKey}
                onChange={(event) => updateProvider(activeProvider, "apiKey", event.target.value)}
              />
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-600">
              Model
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm font-normal text-ink"
                placeholder={aiProviderDefaults[activeProvider]}
                value={activeProviderSettings.model}
                onChange={(event) => updateProvider(activeProvider, "model", event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded bg-ocean px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={activeProviderSettings.apiKey.trim().length < 8}
                onClick={() => saveProvider(activeProvider)}
              >
                <KeyRound className="h-4 w-4" />
                Save
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-red-300 hover:text-red-600"
                onClick={() => clearProvider(activeProvider)}
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-ink">{activeIntegration?.name ?? "Integration"} is not active yet</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">This card is present in the integration library for the next phase. AI generation currently uses API key providers only.</p>
          </div>
        )}

        {savedProvider ? <p className="mt-4 text-sm font-semibold text-emerald-700">{integrationCatalog.find((integration) => integration.generationProvider === savedProvider)?.name} is connected for this browser.</p> : null}
        <button
          type="button"
          className="mt-5 inline-flex items-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-red-300 hover:text-red-600"
          onClick={() => {
            clearAiSettings();
            setSettings(defaultAiSettings);
            setActiveIntegrationId(defaultAiSettings.selectedProvider);
            setSavedProvider(undefined);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Clear all AI keys
        </button>
      </section>
    </main>
  );
};
