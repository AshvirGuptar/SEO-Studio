import { describe, expect, it } from "vitest";
import {
  analyzeAnswer, domainMatches, estimateRunCost, formatBrandLine, parseBrandLine, parseCompetitors, parsePrompts,
  summarizeRun, termRegex, visibilityScore, LIMITS, type TrackedBrand,
} from "./visibility";
import { costMicros, formatUsd } from "../ai/pricing";

const own: TrackedBrand = { name: "Example PC", aliases: ["ExPC"], domains: ["example-pc.com"], own: true };
const rival: TrackedBrand = { name: "Newegg", aliases: [], domains: ["newegg.com"], own: false };
const other: TrackedBrand = { name: "Micro Center", aliases: [], domains: ["microcenter.com"], own: false };
const brands = [own, rival, other];

describe("parsing setup", () => {
  it("dedupes, trims and caps prompts", () => {
    expect(parsePrompts("  best gpu  \n\nBest GPU\nwhere to buy a gpu")).toEqual(["best gpu", "where to buy a gpu"]);
    const many = Array.from({ length: 40 }, (_, i) => `prompt ${i}`).join("\n");
    expect(parsePrompts(many)).toHaveLength(LIMITS.maxPrompts);
  });

  it("parses brand lines with domains and aliases", () => {
    expect(parseBrandLine("Newegg | https://www.newegg.com/, newegg.ca | Newegg.com, Newegg")).toEqual({
      name: "Newegg", domains: ["newegg.com", "newegg.ca"], aliases: ["Newegg.com"], own: false,
    });
    expect(parseBrandLine("   ")).toBeNull();
    expect(parseCompetitors("A\nB | b.com\na")).toHaveLength(2);
  });

  it("round-trips a brand line", () => {
    expect(formatBrandLine(parseBrandLine("Newegg | newegg.com")!)).toBe("Newegg | newegg.com");
    expect(formatBrandLine(own)).toBe("Example PC | example-pc.com | ExPC");
  });
});

describe("matching", () => {
  it("matches whole words, any case, spaces or hyphens", () => {
    const re = () => termRegex("Example PC");
    expect("Try example-pc for deals".match(re())).toHaveLength(1);
    expect("ExamplePC is good".match(re())).toHaveLength(1);
    expect("counterexample pcs".match(re())).toBeNull();
  });

  it("matches domains and subdomains only", () => {
    expect(domainMatches("https://shop.example-pc.com/gpus", ["example-pc.com"])).toBe(true);
    expect(domainMatches("https://www.example-pc.com", ["example-pc.com"])).toBe(true);
    expect(domainMatches("https://notexample-pc.com", ["example-pc.com"])).toBe(false);
    expect(domainMatches("not a url", ["example-pc.com"])).toBe(false);
  });
});

describe("analyzeAnswer", () => {
  const answer = {
    answer: "For 1440p, **Newegg** has the widest range. Example PC and ExPC bundles are cheaper. See [guide](https://micro-center.example/x).",
    citations: [{ url: "https://www.example-pc.com/gpus/1440p", title: "1440p GPUs" }],
    sources: [{ url: "https://newegg.com/gpus", title: null }, { url: "https://www.example-pc.com/gpus/1440p", title: null }],
  };

  it("finds mentions, order, citations and sources", () => {
    const hits = analyzeAnswer(answer, brands);
    const by = Object.fromEntries(hits.map((h) => [h.brand, h]));
    expect(by["Newegg"]).toMatchObject({ mentioned: true, mentions: 1, rank: 1, cited: false, inSources: true });
    expect(by["Example PC"]).toMatchObject({ mentioned: true, mentions: 2, rank: 2, cited: true, inSources: true });
    expect(by["Example PC"].citedUrls).toEqual(["https://www.example-pc.com/gpus/1440p"]);
    expect(by["Micro Center"]).toMatchObject({ mentioned: false, rank: null, cited: false, inSources: false });
  });

  it("ignores brand names that only appear inside link URLs", () => {
    const hits = analyzeAnswer({ answer: "Read [this](https://newegg.com/review)", citations: [], sources: [] }, brands);
    expect(hits.find((h) => h.brand === "Newegg")?.mentioned).toBe(false);
  });
});

describe("summarizeRun", () => {
  it("computes rates, share of voice and the score", () => {
    const r1 = { hits: analyzeAnswer({ answer: "Example PC or Newegg.", citations: [{ url: "https://example-pc.com", title: null }], sources: [] }, brands) };
    const r2 = { hits: analyzeAnswer({ answer: "Newegg, then Newegg again.", citations: [], sources: [] }, brands) };
    const s = summarizeRun([r1, r2], brands);
    expect(s.answered).toBe(2);
    expect(s.own).toMatchObject({ mentionRate: 0.5, citationRate: 0.5, avgRank: 1, promptsMentioned: 1, citationShare: 1 });
    const newegg = s.brands.find((b) => b.brand === "Newegg")!;
    expect(newegg.shareOfVoice).toBeCloseTo(3 / 4);
    expect(newegg.avgRank).toBe(1.5);
    expect(s.score).toBe(visibilityScore({ mentionRate: 0.5, citationRate: 0.5 }));
    expect(s.score).toBe(50);
  });

  it("has no score when nothing was answered", () => {
    expect(summarizeRun([], brands).score).toBeNull();
  });
});

describe("cost", () => {
  it("prices tokens and searches in micro-dollars", () => {
    // 1M input @ $4 + 100k output @ $20 + 2 searches @ $0.01 = 4 + 2 + 0.02
    expect(costMicros("claude-opus-5-5", { inputTokens: 1_000_000, outputTokens: 100_000, webSearches: 2 })).toBe(6_020_000);
    expect(formatUsd(6_020_000)).toBe("$6.02");
    expect(formatUsd(3)).toBe("<$0.01");
  });

  it("estimates a run at roughly $0.05–$0.10 per prompt", () => {
    const { lowMicros, highMicros } = estimateRunCost(1);
    expect(lowMicros).toBeGreaterThanOrEqual(40_000);
    expect(highMicros).toBeLessThanOrEqual(150_000);
  });
});
