/**
 * AI settings that can be tuned per environment without code changes (e.g. a cheaper model on
 * preview/testing, Opus in production). Pure: pass `env` in tests; defaults to process.env.
 */
import { DEFAULT_MODEL } from "./pricing";

type Env = Record<string, string | undefined>;

/**
 * Models AI features may run on, with the request options each one supports.
 * - Dynamic-filtering web search (`web_search_20260209`) is documented for Opus 5.5 and Sonnet 5.5,
 *   not Haiku 5.5, which uses the basic `web_search_20250305` version.
 * - Server-side refusal fallbacks (`fallbacks: "default"`) exist for Opus 5.5 and Sonnet 5.5; Haiku 5.5
 *   has none and rejects a fallback list, so the parameter is omitted for it.
 */
export const SUPPORTED_MODELS = {
  "claude-opus-5-5": { webSearchTool: "web_search_20260209", serverFallback: true },
  "claude-sonnet-5-5": { webSearchTool: "web_search_20260209", serverFallback: true },
  "claude-haiku-5-5": { webSearchTool: "web_search_20250305", serverFallback: false },
} as const;

export type SupportedModel = keyof typeof SUPPORTED_MODELS;

/** AI_MODEL if it's a supported model, otherwise the default (Claude Opus 5.5). Typos fall back safely. */
export function aiModel(env: Env = process.env): SupportedModel {
  const m = env.AI_MODEL?.trim();
  return m && m in SUPPORTED_MODELS ? (m as SupportedModel) : (DEFAULT_MODEL as SupportedModel);
}

export function modelOptions(model: SupportedModel) {
  return SUPPORTED_MODELS[model];
}

/** Web searches allowed per AI Visibility question. Fewer searches = fewer search fees and input tokens. */
export const WEB_SEARCH_LIMITS = { default: 2, min: 1, max: 5 } as const;

export function webSearchMaxUses(env: Env = process.env): number {
  const n = Number(env.AI_WEB_SEARCH_MAX_USES);
  if (!env.AI_WEB_SEARCH_MAX_USES?.trim() || !Number.isInteger(n)) return WEB_SEARCH_LIMITS.default;
  return Math.min(WEB_SEARCH_LIMITS.max, Math.max(WEB_SEARCH_LIMITS.min, n));
}
