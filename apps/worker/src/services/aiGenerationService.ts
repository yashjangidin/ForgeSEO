import type { AiProvider } from "@forgeseo/shared";
import { workerConfig } from "../config.js";

type EndpointKind = "openai-responses" | "openai-compatible" | "anthropic" | "gemini";

interface ProviderConfig {
  label: string;
  defaultModel: string;
  endpointKind: EndpointKind;
  endpoint?: string;
}

interface OpenAiCompatibleResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
    };
  }>;
  usage?: unknown;
  error?: {
    message?: string;
  };
}

interface OpenAiResponsesResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
  incomplete_details?: {
    reason?: string;
  };
  status?: string;
  usage?: unknown;
}

interface AnthropicResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    message?: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

const providerConfigs: Record<AiProvider, ProviderConfig> = {
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-5-mini",
    endpointKind: "openai-responses",
    endpoint: "https://api.openai.com/v1/responses"
  },
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    endpointKind: "gemini"
  },
  anthropic: {
    label: "Anthropic Claude",
    defaultModel: "claude-sonnet-4-5",
    endpointKind: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages"
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "openai/gpt-5-mini",
    endpointKind: "openai-compatible",
    endpoint: "https://openrouter.ai/api/v1/chat/completions"
  },
  perplexity: {
    label: "Perplexity",
    defaultModel: "sonar-pro",
    endpointKind: "openai-compatible",
    endpoint: "https://api.perplexity.ai/chat/completions"
  },
  xai: {
    label: "xAI Grok",
    defaultModel: "grok-4",
    endpointKind: "openai-compatible",
    endpoint: "https://api.x.ai/v1/chat/completions"
  },
  groq: {
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    endpointKind: "openai-compatible",
    endpoint: "https://api.groq.com/openai/v1/chat/completions"
  },
  mistral: {
    label: "Mistral AI",
    defaultModel: "mistral-large-latest",
    endpointKind: "openai-compatible",
    endpoint: "https://api.mistral.ai/v1/chat/completions"
  },
  together: {
    label: "Together AI",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    endpointKind: "openai-compatible",
    endpoint: "https://api.together.xyz/v1/chat/completions"
  }
};

const systemInstruction = "You generate valid JSON only. Do not include markdown fences, comments, HTML, CSS, or JavaScript.";

const parseJsonText = <T>(text: string): T => {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    const tail = withoutFence.slice(-220).replace(/\s+/g, " ");
    throw new Error(`Model returned incomplete or invalid JSON (${message}; ${withoutFence.length} chars; tail="${tail}")`);
  }
};

export class AiGenerationService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly provider: AiProvider;
  private readonly providerConfig: ProviderConfig;

  constructor(options: { provider?: AiProvider; apiKey?: string; model?: string } = {}) {
    this.provider = options.provider ?? "openai";
    this.providerConfig = providerConfigs[this.provider];
    const resolvedKey = options.apiKey?.trim() || (this.provider === "openai" ? workerConfig.openAiApiKey : undefined);
    if (!resolvedKey) {
      throw new Error(`${this.providerConfig.label} API key is required for content generation.`);
    }
    this.apiKey = resolvedKey;
    this.model = options.model?.trim() || (this.provider === "openai" ? workerConfig.openAiModel : this.providerConfig.defaultModel);
  }

  describe(): string {
    return `${this.providerConfig.label} (${this.model})`;
  }

  async generateJson<T>(prompt: string, options: { maxOutputTokens?: number } = {}): Promise<T> {
    const maxOutputTokens = this.maxOutputTokensFor(options.maxOutputTokens);
    if (this.providerConfig.endpointKind === "gemini") {
      return this.generateWithGemini<T>(prompt, maxOutputTokens);
    }
    if (this.providerConfig.endpointKind === "anthropic") {
      return this.generateWithAnthropic<T>(prompt, maxOutputTokens);
    }
    if (this.providerConfig.endpointKind === "openai-responses") {
      return this.generateWithOpenAiResponses<T>(prompt, maxOutputTokens);
    }
    return this.generateWithOpenAiCompatible<T>(prompt, maxOutputTokens);
  }

  private async generateWithOpenAiResponses<T>(prompt: string, maxOutputTokens: number): Promise<T> {
    const response = await fetch(this.requiredEndpoint(), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: "system",
            content: systemInstruction
          },
          {
            role: "user",
            content: prompt
          }
        ],
        text: {
          format: { type: "json_object" },
          verbosity: "medium"
        },
        reasoning: {
          effort: "minimal"
        },
        max_output_tokens: maxOutputTokens,
        store: false
      })
    });

    const body = (await response.json().catch(() => ({}))) as OpenAiResponsesResponse;
    if (!response.ok) {
      throw new Error(body.error?.message ?? `OpenAI request failed with status ${response.status}.`);
    }
    if (body.status === "incomplete") {
      const details = [
        body.incomplete_details?.reason ? `reason=${body.incomplete_details.reason}` : undefined,
        body.usage ? `usage=${JSON.stringify(body.usage)}` : undefined
      ].filter(Boolean).join("; ");
      throw new Error(`OpenAI stopped before returning complete JSON${details ? ` (${details})` : ""}.`);
    }

    const text = this.extractOpenAiResponseText(body);
    if (!text.trim()) {
      const details = [
        body.status ? `status=${body.status}` : undefined,
        body.incomplete_details?.reason ? `reason=${body.incomplete_details.reason}` : undefined,
        body.usage ? `usage=${JSON.stringify(body.usage)}` : undefined
      ].filter(Boolean).join("; ");
      throw new Error(`OpenAI returned an empty response${details ? ` (${details})` : ""}.`);
    }

    return parseJsonText<T>(text);
  }

  private async generateWithOpenAiCompatible<T>(prompt: string, maxOutputTokens: number): Promise<T> {
    const fetchCompletion = async (useJsonMode: boolean) => {
      const payload: Record<string, unknown> = {
        model: this.model,
        messages: [
          {
            role: "system",
            content: systemInstruction
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: maxOutputTokens
      };

      if (useJsonMode) {
        payload.response_format = { type: "json_object" };
      }

      return fetch(this.requiredEndpoint(), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    };

    let response = await fetchCompletion(true);
    let body = (await response.json().catch(() => ({}))) as OpenAiCompatibleResponse;

    if (!response.ok && /response_format|json_object/i.test(body.error?.message ?? "")) {
      response = await fetchCompletion(false);
      body = (await response.json().catch(() => ({}))) as OpenAiCompatibleResponse;
    }

    if (!response.ok) {
      throw new Error(body.error?.message ?? `${this.providerConfig.label} request failed with status ${response.status}.`);
    }

    if (body.choices?.[0]?.finish_reason === "length") {
      throw new Error(`${this.providerConfig.label} stopped because max_tokens was reached. Reduce page count/content length or increase the model output budget.`);
    }

    const text = body.choices?.[0]?.message?.content;
    if (!text?.trim()) {
      const details = [
        body.choices?.[0]?.finish_reason ? `finish_reason=${body.choices[0].finish_reason}` : undefined,
        body.usage ? `usage=${JSON.stringify(body.usage)}` : undefined
      ].filter(Boolean).join("; ");
      throw new Error(`${this.providerConfig.label} returned an empty response${details ? ` (${details})` : ""}.`);
    }

    return parseJsonText<T>(text);
  }

  private async generateWithAnthropic<T>(prompt: string, maxOutputTokens: number): Promise<T> {
    const response = await fetch(this.requiredEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: this.model,
        system: systemInstruction,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: maxOutputTokens
      })
    });

    const body = (await response.json().catch(() => ({}))) as AnthropicResponse;
    if (!response.ok) {
      throw new Error(body.error?.message ?? `${this.providerConfig.label} request failed with status ${response.status}.`);
    }

    const text = body.content?.map((part) => part.text).filter(Boolean).join("\n");
    if (!text?.trim()) {
      throw new Error(`${this.providerConfig.label} returned an empty response.`);
    }

    return parseJsonText<T>(text);
  }

  private async generateWithGemini<T>(prompt: string, maxOutputTokens: number): Promise<T> {
    const modelPath = this.model.startsWith("models/") ? this.model : `models/${this.model}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens
        }
      })
    });

    const body = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      throw new Error(body.error?.message ?? `${this.providerConfig.label} request failed with status ${response.status}.`);
    }

    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n");
    if (!text?.trim()) {
      throw new Error(`${this.providerConfig.label} returned an empty response.`);
    }

    return parseJsonText<T>(text);
  }

  private requiredEndpoint(): string {
    if (!this.providerConfig.endpoint) {
      throw new Error(`${this.providerConfig.label} endpoint is not configured.`);
    }
    return this.providerConfig.endpoint;
  }

  private extractOpenAiResponseText(body: OpenAiResponsesResponse): string {
    if (body.output_text?.trim()) {
      return body.output_text;
    }

    return body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text?.trim()))
      .join("\n") ?? "";
  }

  private maxOutputTokensFor(requested?: number): number {
    const fallback = this.provider === "openai" ? 24_000 : 18_000;
    const resolved = Math.max(1_000, Math.floor(requested ?? fallback));
    if (this.provider === "openrouter") {
      return Math.min(resolved, 16_000);
    }
    if (this.provider === "openai") {
      return Math.min(resolved, 24_000);
    }
    return Math.min(resolved, 24_000);
  }
}
