import { describe, expect, it } from "vitest";
import { aiModel, modelOptions, webSearchMaxUses } from "./config";
import { DEFAULT_LIMITS, aiLimits } from "./budget";
import { estimateRunCost } from "../seo/visibility";

describe("AI settings", () => {
  it("uses Claude Opus 5.5 unless AI_MODEL names a supported model", () => {
    expect(aiModel({})).toBe("claude-opus-5-5");
    expect(aiModel({ AI_MODEL: "claude-haiku-5-5" })).toBe("claude-haiku-5-5");
    expect(aiModel({ AI_MODEL: " claude-sonnet-5-5 " })).toBe("claude-sonnet-5-5");
    expect(aiModel({ AI_MODEL: "claude-haiku-55" })).toBe("claude-opus-5-5"); // typo falls back
  });

  it("picks request options each model supports", () => {
    expect(modelOptions("claude-opus-5-5")).toEqual({ webSearchTool: "web_search_20260209", serverFallback: true });
    expect(modelOptions("claude-haiku-5-5")).toEqual({ webSearchTool: "web_search_20250305", serverFallback: false });
  });

  it("defaults to 2 web searches per question, clamped to 1–5", () => {
    expect(webSearchMaxUses({})).toBe(2);
    expect(webSearchMaxUses({ AI_WEB_SEARCH_MAX_USES: "3" })).toBe(3);
    expect(webSearchMaxUses({ AI_WEB_SEARCH_MAX_USES: "0" })).toBe(1);
    expect(webSearchMaxUses({ AI_WEB_SEARCH_MAX_USES: "99" })).toBe(5);
    expect(webSearchMaxUses({ AI_WEB_SEARCH_MAX_USES: "abc" })).toBe(2);
  });

  it("defaults budgets to the $10 starter credits: $10/month, $2/person/day", () => {
    expect(DEFAULT_LIMITS).toEqual({ dailyUserUsd: 2, monthlyUsd: 10 });
    expect(aiLimits({})).toEqual({ dailyUserMicros: 2_000_000, monthlyMicros: 10_000_000 });
    expect(aiLimits({ AI_MONTHLY_BUDGET_USD: "50" }).monthlyMicros).toBe(50_000_000);
  });

  it("estimates follow the model and search limit", () => {
    const opus3 = estimateRunCost(10, "claude-opus-5-5", 3).highMicros;
    const opus2 = estimateRunCost(10, "claude-opus-5-5", 2).highMicros;
    const haiku2 = estimateRunCost(10, "claude-haiku-5-5", 2).highMicros;
    expect(opus2).toBeLessThan(opus3);
    expect(haiku2).toBeLessThan(opus2 / 3);
  });
});

describe("budget alerts", () => {
  it("reports which alert levels are reached", async () => {
    const { crossedThresholds } = await import("./budget");
    expect(crossedThresholds(4_000_000, 10_000_000)).toEqual([]);
    expect(crossedThresholds(5_000_000, 10_000_000)).toEqual([50]);
    expect(crossedThresholds(8_500_000, 10_000_000)).toEqual([50, 80]);
    expect(crossedThresholds(12_000_000, 10_000_000)).toEqual([50, 80, 100]);
    expect(crossedThresholds(1, 0)).toEqual([]);
  });
});
