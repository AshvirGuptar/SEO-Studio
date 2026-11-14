/**
 * Claude API prices and cost math. Pure (no SDK, no env) so it runs in tests and in the browser
 * (for cost estimates). Money is kept in integer micro-dollars (1 USD = 1_000_000) to avoid float drift.
 */

/** Default model for every AI feature (see CLAUDE.md). */
export const DEFAULT_MODEL = "claude-opus-5-5";

/** USD per million tokens. Cache writes use the 5-minute TTL price (1.25x input). */
export const MODEL_PRICES: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};

/** Web search is billed per search: $10 per 1,000. */
export const WEB_SEARCH_USD = 0.01;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  webSearches?: number;
}

export const USD = 1_000_000;

/** Cost of one request in micro-dollars. Unknown models are priced as the default model. */
export function costMicros(model: string, u: TokenUsage): number {
  const p = MODEL_PRICES[model] ?? MODEL_PRICES[DEFAULT_MODEL];
  // price is USD per 1M tokens, so tokens * price = micro-dollars.
  const tokens =
    u.inputTokens * p.input +
    u.outputTokens * p.output +
    (u.cacheWriteTokens ?? 0) * p.cacheWrite +
    (u.cacheReadTokens ?? 0) * p.cacheRead;
  return Math.round(tokens + (u.webSearches ?? 0) * WEB_SEARCH_USD * USD);
}

export function formatUsd(micros: number, digits = 2): string {
  const usd = micros / USD;
  if (usd > 0 && usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(digits)}`;
}
