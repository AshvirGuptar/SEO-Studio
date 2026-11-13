/**
 * Turns a Claude web-search response into plain data: the answer text, the sources it cited inline,
 * and every search result it saw. Pure (types only from the SDK) so it's unit-tested with fixtures.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { Source } from "../seo/visibility";
import type { TokenUsage } from "./pricing";

type Block = Anthropic.Beta.Messages.BetaContentBlock;

export interface ParsedAnswer {
  answer: string;
  citations: Source[];
  sources: Source[];
  searchErrors: string[];
}

export function parseAnswer(content: Block[]): ParsedAnswer {
  let answer = "";
  const citations = new Map<string, Source>();
  const sources = new Map<string, Source>();
  const searchErrors: string[] = [];

  for (const block of content) {
    if (block.type === "text") {
      answer += block.text;
      for (const c of block.citations ?? []) {
        if (c.type === "web_search_result_location" && !citations.has(c.url)) citations.set(c.url, { url: c.url, title: c.title ?? null });
      }
    } else if (block.type === "web_search_tool_result") {
      // Errors arrive as an object with HTTP 200, results as a list.
      if (Array.isArray(block.content)) {
        for (const r of block.content) if (!sources.has(r.url)) sources.set(r.url, { url: r.url, title: r.title ?? null });
      } else {
        searchErrors.push(block.content.error_code);
      }
    }
  }
  return { answer: answer.trim(), citations: [...citations.values()], sources: [...sources.values()], searchErrors };
}

/** Adds up usage across the requests of one answer (a paused turn takes more than one request). */
export function addUsage(total: TokenUsage, u: Anthropic.Beta.Messages.BetaUsage): TokenUsage {
  return {
    inputTokens: total.inputTokens + (u.input_tokens ?? 0),
    outputTokens: total.outputTokens + (u.output_tokens ?? 0),
    cacheReadTokens: (total.cacheReadTokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    cacheWriteTokens: (total.cacheWriteTokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    webSearches: (total.webSearches ?? 0) + (u.server_tool_use?.web_search_requests ?? 0),
  };
}
