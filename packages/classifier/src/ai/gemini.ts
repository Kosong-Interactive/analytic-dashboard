import { GoogleGenAI } from "@google/genai";

import type { ClassificationInput } from "../input.js";
import type { Taxonomy } from "../taxonomy.js";
import {
  AI_PROMPT_VERSION,
  buildSystemInstruction,
  buildUserPrompt,
  parseAiResponse,
  responseJsonSchema,
  toPromptApps,
  type AiAppResult,
} from "./prompt.js";

/** Cheapest first, like the admin-chat rotation: lite models, then flash. Pro and media models are excluded. */
export const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
] as const;

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredGeneration<T> {
  model: string;
  value: T;
  inputTokens: number;
  outputTokens: number;
}

class InvalidStructuredOutput extends Error {
  constructor(readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : "Structured output validation failed");
    this.name = "InvalidStructuredOutput";
  }
}

/** The two SDK calls the provider needs, so model rotation is testable without the network. */
export interface GeminiClient {
  listModels(): Promise<string[]>;
  generate(
    model: string,
    request: { systemInstruction: string; prompt: string; schema: Record<string, unknown> },
  ): Promise<GenerateResult>;
}

export type GeminiErrorKind = "quota" | "unavailable" | "not_found" | "fatal";

/** Quota and missing models rotate to the next model; auth and bad-request errors stop the run. */
export function classifyGeminiError(error: unknown): GeminiErrorKind {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) return "quota";
  if (status === 404 || /NOT_FOUND/.test(message)) return "not_found";
  if ((status !== undefined && status >= 500) || /UNAVAILABLE|overloaded|timeout|ECONN|fetch failed/i.test(message)) {
    return "unavailable";
  }
  return "fatal";
}

export class AllModelsExhaustedError extends Error {
  constructor() {
    super("Every configured Gemini model is out of quota or unavailable for this run");
    this.name = "AllModelsExhaustedError";
  }
}

export class GeminiFatalError extends Error {
  constructor(readonly model: string, readonly status: number | undefined) {
    super(`Gemini request to ${model} failed${status ? ` with HTTP ${status}` : ""}`);
    this.name = "GeminiFatalError";
  }
}

export interface BatchResult {
  model: string;
  promptVersion: string;
  results: AiAppResult[];
  inputTokens: number;
  outputTokens: number;
}

export interface GeminiProviderOptions {
  client: GeminiClient;
  preferredModels?: readonly string[];
  sleep?: (ms: number) => Promise<void>;
  /** Spacing between requests to stay under free-tier per-minute limits. */
  minimumRequestIntervalMs?: number;
  now?: () => number;
  /** Progress hook, e.g. for run logs. Never receives prompt text or the API key. */
  onEvent?: (event: { model: string; outcome: string; ms: number }) => void;
}

/**
 * Classifies batches with the first usable model. The model list is fetched once and intersected
 * with the preference order; a model that runs out of quota is skipped for the rest of the run.
 */
export class GeminiProvider {
  private readonly client: GeminiClient;
  private readonly preferred: readonly string[];
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly onEvent: NonNullable<GeminiProviderOptions["onEvent"]>;
  private models: string[] | null = null;
  private readonly exhausted = new Set<string>();
  private nextRequestAt = 0;
  readonly events: string[] = [];

  constructor(options: GeminiProviderOptions) {
    this.client = options.client;
    this.preferred = options.preferredModels ?? DEFAULT_GEMINI_MODELS;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.intervalMs = options.minimumRequestIntervalMs ?? 4_000;
    this.now = options.now ?? Date.now;
    this.onEvent = options.onEvent ?? (() => undefined);
  }

  /** Models that will be tried, in order. Falls back to the preference list if listing fails. */
  async availableModels(): Promise<string[]> {
    if (this.models) return this.models;
    try {
      const listed = new Set(await this.client.listModels());
      this.models = this.preferred.filter((model) => listed.has(model));
    } catch (error) {
      this.events.push(`model list failed (${classifyGeminiError(error)}); using the preference order`);
      this.models = [...this.preferred];
    }
    return this.models;
  }

  async classifyBatch(inputs: readonly ClassificationInput[], taxonomy: Taxonomy): Promise<BatchResult> {
    const request = {
      systemInstruction: buildSystemInstruction(taxonomy),
      prompt: buildUserPrompt(toPromptApps(inputs)),
      schema: responseJsonSchema(taxonomy),
    };

    const generated = await this.generateStructured(request, (raw) => parseAiResponse(raw, inputs, taxonomy));
    return {
      model: generated.model,
      promptVersion: AI_PROMPT_VERSION,
      results: generated.value,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
    };
  }

  /** Shared structured generation path for classification and evidence-constrained research briefs. */
  async generateStructured<T>(
    request: { systemInstruction: string; prompt: string; schema: Record<string, unknown> },
    parse: (raw: string) => T,
  ): Promise<StructuredGeneration<T>> {
    const models = await this.availableModels();

    for (const model of models) {
      if (this.exhausted.has(model)) continue;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await this.waitForTurn();
        const started = this.now();
        try {
          const response = await this.client.generate(model, request);
          let value: T;
          try {
            value = parse(response.text);
          } catch (error) {
            throw new InvalidStructuredOutput(error);
          }
          this.onEvent({ model, outcome: "ok", ms: this.now() - started });
          return {
            model,
            value,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
          };
        } catch (error) {
          this.onEvent({
            model,
            outcome: error instanceof InvalidStructuredOutput ? "invalid_output" : classifyGeminiError(error),
            ms: this.now() - started,
          });
          if (error instanceof InvalidStructuredOutput) {
            // Malformed output: one retry on the same model, then move on.
            this.events.push(`${model}: ${error.message}`);
            if (attempt === 0) continue;
            break;
          }
          const kind = classifyGeminiError(error);
          if (kind === "unavailable" && attempt === 0) {
            await this.sleep(2_000 + Math.floor(Math.random() * 1_000));
            continue;
          }
          if (kind === "fatal") {
            const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
            throw new GeminiFatalError(model, status);
          }
          this.events.push(`${model}: ${kind}, switching model`);
          this.exhausted.add(model);
          break;
        }
      }
    }
    throw new AllModelsExhaustedError();
  }

  private async waitForTurn(): Promise<void> {
    const now = this.now();
    const wait = Math.max(0, this.nextRequestAt - now);
    if (wait > 0) await this.sleep(wait);
    this.nextRequestAt = Math.max(now, this.nextRequestAt) + this.intervalMs;
  }
}

/** Real client over the official SDK. The key is read by the caller and never logged. */
export function createGeminiClient(apiKey: string): GeminiClient {
  const ai = new GoogleGenAI({
    apiKey,
    // The SDK retries 429s itself (up to 5 times with minute-long waits); rotation handles that
    // here instead, so a model that is out of quota is left immediately.
    httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } },
  });
  return {
    async listModels() {
      const names: string[] = [];
      for await (const model of await ai.models.list({ config: { pageSize: 100 } })) {
        if (model.name && model.supportedActions?.includes("generateContent")) {
          names.push(model.name.replace(/^models\//, ""));
        }
      }
      return names;
    },
    async generate(model, request) {
      const response = await ai.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          systemInstruction: request.systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema: request.schema,
          temperature: 0,
          // A batch of 8 needs ~3k tokens; the cap stops a runaway, repetitive generation.
          maxOutputTokens: 8_192,
        },
      });
      return {
        text: response.text ?? "",
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      };
    },
  };
}
