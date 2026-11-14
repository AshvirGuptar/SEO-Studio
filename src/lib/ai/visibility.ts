/**
 * Asks Claude a customer's question the way an AI answer engine would: with live web search,
 * and no hint about which brand we're tracking (so the answer isn't biased toward it).
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./client";
import { addUsage, parseAnswer, type ParsedAnswer } from "./answer";
import { costMicros, type TokenUsage } from "./pricing";
import { aiModel, modelOptions, webSearchMaxUses } from "./config";

/** Fixed (never interpolated) so every run asks the same way and results compare across weeks. */
const SYSTEM = `You are an AI assistant answering a real person's question, like an AI search engine would.
Search the web for current information, then answer directly and helpfully.
When the question is about products, stores, services or brands, name the specific ones you would recommend and briefly say why.
Cite the sources you relied on. Keep the answer under 300 words.`;

/** A paused server-tool turn is resumed at most this many times. */
const MAX_CONTINUATIONS = 3;

export interface AskResult extends ParsedAnswer {
  model: string;
  usage: TokenUsage;
  costMicros: number;
}

export class AskError extends Error {
  constructor(message: string, readonly usage: TokenUsage, readonly costMicros: number, readonly model: string) {
    super(message);
  }
}

export async function askWithWebSearch(prompt: string): Promise<AskResult> {
  const client = getAnthropic();
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: prompt }];
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let cost = 0;
  const requestModel = aiModel();
  const options = modelOptions(requestModel);
  const maxUses = webSearchMaxUses();
  let model: string = requestModel;
  const content: Anthropic.Beta.Messages.BetaContentBlock[] = [];

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const response = await client.beta.messages.create({
      model: requestModel,
      max_tokens: 16000,
      system: SYSTEM,
      messages,
      tools: [{ type: options.webSearchTool, name: "web_search", max_uses: maxUses }],
      output_config: { effort: "medium" },
      // Opus/Sonnet: if a safety classifier declines, the API retries on a fallback model inside the
      // same call. Haiku 5.5 has no server-side fallback, so the parameter (and its beta) is omitted.
      ...(options.serverFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    model = response.model;
    usage = addUsage(usage, response.usage);
    cost += costMicros(response.model, {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      webSearches: response.usage.server_tool_use?.web_search_requests ?? 0,
    });
    content.push(...response.content);

    if (response.stop_reason === "refusal") {
      throw new AskError("The assistant declined to answer this prompt.", usage, cost, model);
    }
    if (response.stop_reason !== "pause_turn") break;
    // Long server-tool turns pause; send the partial turn back to let it continue.
    messages.push({ role: "assistant", content: response.content });
  }

  const parsed = parseAnswer(content);
  if (!parsed.answer) {
    const why = parsed.searchErrors.length ? ` (web search: ${parsed.searchErrors.join(", ")})` : "";
    throw new AskError(`No answer came back${why}.`, usage, cost, model);
  }
  return { ...parsed, model, usage, costMicros: cost };
}

/** User-facing message for an SDK error; never leaks the key or raw payloads. */
export function describeAiError(e: unknown): string {
  if (e instanceof AskError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. An admin needs to check ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.RateLimitError) return "The AI service is rate limiting requests. Try again in a minute.";
  if (e instanceof Anthropic.BadRequestError) return "The AI service rejected the request.";
  if (e instanceof Anthropic.APIConnectionTimeoutError) return "The AI service took too long to answer.";
  if (e instanceof Anthropic.APIError) return `The AI service returned an error (${e.status ?? "network"}).`;
  return "Something went wrong asking the AI service.";
}
