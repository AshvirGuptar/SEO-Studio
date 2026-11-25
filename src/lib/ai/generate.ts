/**
 * Shared Claude call for AI writing features (server-only): streams the response (no HTTP timeouts
 * on long outputs), caches the fixed instructions, asks for JSON matching a schema, checks the
 * budget first, and records usage afterwards. AI rewrite uses it; GEO Optimization will too.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { getAnthropic } from "./client";
import { addUsage } from "./answer";
import { checkBudget } from "./budget";
import { aiModel, modelOptions } from "./config";
import { costMicros, type TokenUsage } from "./pricing";
import { recordAiUsage } from "./usage";

export class GenerateError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export interface GenerateResult<T> {
  data: T;
  model: string;
  usage: TokenUsage;
  costMicros: number;
}

export async function generateJson<T>(opts: {
  feature: string;
  userId: string | null;
  projectId?: string | null;
  /** Fixed instructions (identical across requests, so they're cached). */
  system: string;
  /** The request-specific content. */
  prompt: string;
  /** JSON Schema the answer must follow (strict: additionalProperties false, all keys required). */
  schema: Record<string, unknown>;
  /** Validates the parsed JSON (the schema guarantees shape; this gives types and limits). */
  validate: z.ZodType<T>;
  /** Rough upper cost (micro-dollars) checked against the budget before calling. */
  estimateMicros: number;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<GenerateResult<T>> {
  const budget = await checkBudget(opts.userId, opts.estimateMicros);
  if (!budget.ok) throw new GenerateError(budget.reason!, 402);
  const { message, usage, cost } = await callClaudeJson(opts);
  await recordAiUsage({ userId: opts.userId, projectId: opts.projectId ?? null, feature: opts.feature, model: message.model, usage, costMicros: cost });
  return { data: parseJsonAnswer(message, opts.validate), model: message.model, usage, costMicros: cost };
}

/**
 * The bare Claude request (no budget check, no logging): used by generateJson and by the evaluation
 * runner (docs/eval), so both send identical requests.
 */
export async function callClaudeJson(opts: {
  system: string; prompt: string; schema: Record<string, unknown>; maxTokens?: number; effort?: "low" | "medium" | "high";
}): Promise<{ message: Anthropic.Beta.Messages.BetaMessage; usage: TokenUsage; cost: number }> {
  const model = aiModel();
  const options = modelOptions(model);
  const stream = getAnthropic().beta.messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 8000,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.prompt }],
    output_config: { effort: opts.effort ?? "medium", format: { type: "json_schema", schema: opts.schema } },
    // Opus/Sonnet: a safety-classifier decline is retried on a fallback model inside the same call.
    ...(options.serverFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });

  let message: Anthropic.Beta.Messages.BetaMessage;
  try {
    message = await stream.finalMessage();
  } catch (e) {
    throw new GenerateError(describeGenerateError(e));
  }

  const usage = addUsage({ inputTokens: 0, outputTokens: 0 }, message.usage);
  return { message, usage, cost: costMicros(message.model, usage) };
}

/** Reads and validates the JSON answer (throws GenerateError with a plain-English message). */
export function parseJsonAnswer<T>(message: Anthropic.Beta.Messages.BetaMessage, validate: z.ZodType<T>): T {
  if (message.stop_reason === "refusal") throw new GenerateError("The assistant declined this request.");
  if (message.stop_reason === "max_tokens") throw new GenerateError("The answer was cut off. Try shorter input.");
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GenerateError("The AI returned an unreadable answer. Please try again.");
  }
  const parsed = validate.safeParse(json);
  if (!parsed.success) throw new GenerateError("The AI's answer was missing parts. Please try again.");
  return parsed.data;
}

function describeGenerateError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. An admin needs to check ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.RateLimitError) return "The AI service is busy. Try again in a minute.";
  if (e instanceof Anthropic.APIConnectionTimeoutError) return "The AI service took too long to answer.";
  if (e instanceof Anthropic.BadRequestError) return "The AI service rejected the request.";
  if (e instanceof Anthropic.APIError) return `The AI service returned an error (${e.status ?? "network"}).`;
  return "Something went wrong asking the AI service.";
}
