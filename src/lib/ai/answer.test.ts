import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { addUsage, parseAnswer } from "./answer";
import { aiEnabled, aiLimits } from "./budget";

type Block = Anthropic.Beta.Messages.BetaContentBlock;

// Fixture shaped like a real web-search response (fields the parser doesn't read are cast away).
const content = [
  { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "best gpu 1440p" } },
  {
    type: "web_search_tool_result", tool_use_id: "s1",
    content: [
      { type: "web_search_result", url: "https://newegg.com/gpus", title: "GPUs", encrypted_content: "x", page_age: null },
      { type: "web_search_result", url: "https://example-pc.com/1440p", title: "1440p picks", encrypted_content: "x", page_age: null },
    ],
  },
  { type: "text", text: "Top picks: ", citations: null },
  {
    type: "text", text: "Example PC's 1440p bundle.",
    citations: [
      { type: "web_search_result_location", url: "https://example-pc.com/1440p", title: "1440p picks", cited_text: "…", encrypted_index: "x" },
      { type: "web_search_result_location", url: "https://example-pc.com/1440p", title: "1440p picks", cited_text: "…", encrypted_index: "y" },
    ],
  },
  { type: "web_search_tool_result", tool_use_id: "s2", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
] as unknown as Block[];

describe("parseAnswer", () => {
  it("joins text, dedupes citations and collects search results and errors", () => {
    const p = parseAnswer(content);
    expect(p.answer).toBe("Top picks: Example PC's 1440p bundle.");
    expect(p.citations).toEqual([{ url: "https://example-pc.com/1440p", title: "1440p picks" }]);
    expect(p.sources.map((s) => s.url)).toEqual(["https://newegg.com/gpus", "https://example-pc.com/1440p"]);
    expect(p.searchErrors).toEqual(["max_uses_exceeded"]);
  });

  it("adds usage across paused turns", () => {
    const u = { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 5, cache_creation_input_tokens: null, server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 } } as unknown as Anthropic.Beta.Messages.BetaUsage;
    expect(addUsage(addUsage({ inputTokens: 0, outputTokens: 0 }, u), u)).toEqual({
      inputTokens: 200, outputTokens: 20, cacheReadTokens: 10, cacheWriteTokens: 0, webSearches: 4,
    });
  });
});

describe("AI config", () => {
  it("is off without a key and reads limits with defaults", () => {
    expect(aiEnabled({})).toBe(false);
    expect(aiEnabled({ ANTHROPIC_API_KEY: "  " })).toBe(false);
    expect(aiEnabled({ ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(aiLimits({})).toEqual({ dailyUserMicros: 2_000_000, monthlyMicros: 10_000_000 });
    expect(aiLimits({ AI_DAILY_USER_LIMIT_USD: "1.5", AI_MONTHLY_BUDGET_USD: "nope" })).toEqual({ dailyUserMicros: 1_500_000, monthlyMicros: 10_000_000 });
  });
});
