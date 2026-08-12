import type { CapabilityState, GenerationJob, StartGenerationRequest, StartGenerationResponse, TemplateSummary } from "@forgeseo/shared";
import { auth } from "./firebase";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly details: {
      url?: string;
      status?: number;
      statusText?: string;
      contentType?: string;
      body?: string;
    } = {}
  ) {
    super(message);
  }
}

const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");
const configuredFallbackApiBaseUrl = String(import.meta.env.VITE_API_FALLBACK_BASE_URL ?? "").trim().replace(/\/$/, "");
const isLocalApiBaseUrl = (url: string): boolean => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(url);
const configuredApiBaseUrls = [configuredApiBaseUrl, configuredFallbackApiBaseUrl].filter(
  (url, index, urls) => url && urls.indexOf(url) === index
);
const apiBaseUrls = import.meta.env.DEV
  ? configuredApiBaseUrls.length
    ? configuredApiBaseUrls
    : [""]
  : configuredApiBaseUrls.filter((url) => !isLocalApiBaseUrl(url));

const firstApiBaseUrl = (): string => apiBaseUrls[0] ?? "";

const withCacheBuster = (path: string): string => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}_=${Date.now()}`;
};

const parseJsonObject = (input: string): { message?: string; error?: string } | undefined => {
  try {
    const parsed = JSON.parse(input) as unknown;
    return parsed && typeof parsed === "object" ? parsed as { message?: string; error?: string } : undefined;
  } catch {
    return undefined;
  }
};

const fetchWithApiFallback = async (path: string, init?: RequestInit): Promise<Response> => {
  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (const baseUrl of apiBaseUrls.length ? apiBaseUrls : [""]) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        cache: "no-store",
        ...init,
        headers: {
          Accept: "application/json",
          ...init?.headers
        }
      });
      if (response.ok || response.status < 500) {
        return response;
      }
      lastResponse = response;
      lastError = new ApiRequestError(`API request failed with HTTP ${response.status}.`, {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type") ?? undefined,
        body: await response.clone().text().catch(() => "")
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Could not reach the ForgeSEO API.");
};

const readJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    const parsedBody = contentType.includes("application/json") ? parseJsonObject(responseText || "{}") : undefined;
    const parsed = typeof parsedBody === "object" && parsedBody ? parsedBody : undefined;
    throw new ApiRequestError(parsed?.message || parsed?.error || `${fallbackMessage} HTTP ${response.status}.`, {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      contentType,
      body: responseText.slice(0, 2000)
    });
  }
  if (!contentType.includes("application/json")) {
    const body = await response.text().catch(() => "");
    throw new ApiRequestError(`${fallbackMessage} Expected JSON from ${response.url}, but received ${contentType || "unknown content"}.`, {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      contentType,
      body: body.slice(0, 2000)
    });
  }
  return response.json() as Promise<T>;
};

const getIdToken = async (): Promise<string> => {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("Sign in to continue.");
  }
  return user.getIdToken();
};

export const getCapabilities = async (): Promise<CapabilityState> => {
  const response = await fetchWithApiFallback(withCacheBuster("/api/capabilities"));
  return readJsonResponse<CapabilityState>(response, "Could not load integration status.");
};

export const getTemplates = async (): Promise<TemplateSummary[]> => {
  const response = await fetchWithApiFallback(withCacheBuster("/api/templates"));
  const templates = await readJsonResponse<TemplateSummary[]>(response, "Could not load template library.");
  return templates.map((template) => ({
    ...template,
    previewImageUrl: template.previewImageUrl ? `${firstApiBaseUrl()}${template.previewImageUrl}` : undefined
  }));
};

export const startGeneration = async (payload: StartGenerationRequest): Promise<StartGenerationResponse> => {
  const token = await getIdToken();
  const response = await fetchWithApiFallback("/api/generation/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; issues?: Array<{ path?: string; message?: string }> };
    const issues = body.issues
      ?.map((issue) => [issue.path, issue.message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join(" ");
    throw new Error(issues || body.message || "Could not start website generation.");
  }

  return readJsonResponse<StartGenerationResponse>(response, "Could not start website generation.");
};

export const getGenerationJob = async (jobId: string): Promise<GenerationJob> => {
  const token = await getIdToken();
  const response = await fetchWithApiFallback(withCacheBuster(`/api/generation/jobs/${jobId}`), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return readJsonResponse<GenerationJob>(response, "Could not load generation job.");
};
