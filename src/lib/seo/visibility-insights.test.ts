import { describe, expect, it } from "vitest";
import { runHeadline, scoreDelta, topCitedSources, visibilityGaps } from "./visibility-insights";
import { summarizeRun, type BrandHit, type TrackedBrand } from "./visibility";

const own: TrackedBrand = { name: "Example PC", aliases: [], domains: ["example-pc.com"], own: true };
const rival: TrackedBrand = { name: "Newegg", aliases: [], domains: ["newegg.com"], own: false };
const hit = (brand: string, isOwn: boolean, rank: number | null, cited = false): BrandHit => ({
  brand, own: isOwn, mentioned: rank !== null, mentions: rank ? 1 : 0, rank, cited, citedUrls: [], inSources: false,
});

describe("visibility insights", () => {
  it("counts each cited site once per answer and tags tracked brands", () => {
    const top = topCitedSources([
      { citations: [{ url: "https://www.newegg.com/a", title: null }, { url: "https://newegg.com/b", title: null }, { url: "https://shop.example-pc.com/x", title: null }] },
      { citations: [{ url: "https://newegg.com/c", title: null }, { url: "https://www.tomshardware.com/r", title: null }] },
    ], [own, rival]);
    expect(top[0]).toEqual({ domain: "newegg.com", answers: 2, brand: "Newegg", own: false });
    expect(top.find((t) => t.domain === "shop.example-pc.com")).toMatchObject({ brand: "Example PC", own: true });
    expect(top.find((t) => t.domain === "tomshardware.com")).toMatchObject({ brand: null, own: false });
  });

  it("finds questions where competitors are named but you aren't", () => {
    const gaps = visibilityGaps([
      { prompt: "a", hits: [hit("Example PC", true, 1), hit("Newegg", false, 2)] },
      { prompt: "b", hits: [hit("Example PC", true, null), hit("Newegg", false, 1)] },
      { prompt: "c", hits: [hit("Example PC", true, null), hit("Newegg", false, null)] },
    ]);
    expect(gaps).toEqual([{ prompt: "b", competitors: ["Newegg"] }]);
  });

  it("computes deltas and a readable headline", () => {
    expect(scoreDelta(40, 32)).toBe(8);
    expect(scoreDelta(40, null)).toBeNull();
    const s = summarizeRun([
      { hits: [hit("Example PC", true, 2, true), hit("Newegg", false, 1)] },
      { hits: [hit("Example PC", true, null), hit("Newegg", false, 1)] },
    ], [own, rival]);
    expect(runHeadline(s)).toBe("Example PC was named in 1 of 2 answers and its site was cited in 1. Newegg leads share of voice at 67%.");
  });
});
