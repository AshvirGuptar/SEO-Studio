import { describe, expect, it } from "vitest";
import { buildRewritePrompt, REWRITE_SYSTEM, scoreDescription, scoreTitleMeta, type RewriteInput } from "./rewrite";

const input: RewriteInput = {
  kind: "title-meta", keyword: "1440p graphics card", preset: "product", tone: "clear",
  title: "Aurora 12GB | Example PC", meta: "Buy now.",
  body: "The Aurora 12GB has 12 GB of GDDR6X memory and a 3-year warranty. It costs $549.",
  specs: "Boost clock: 2,610 MHz\nRecommended PSU: 650 W",
};

describe("rewrite prompts", () => {
  it("keeps the fixed instructions brand-free and puts the copy in the request", () => {
    expect(REWRITE_SYSTEM).not.toMatch(/Example PC|Aurora/);
    const p = buildRewritePrompt(input);
    expect(p).toContain("<original_title>\nAurora 12GB | Example PC\n</original_title>");
    expect(p).toContain("Target keyword: 1440p graphics card");
  });
});

describe("scoring suggestions", () => {
  it("re-scores title/meta variants and flags invented facts", () => {
    const [good, bad] = scoreTitleMeta(input, { variants: [
      { title: "Aurora 12GB 1440p Graphics Card with 12 GB GDDR6X | Example PC", meta: "Smooth 1440p gaming with 12 GB of GDDR6X memory and a 3-year warranty. Compare specs and order the Aurora 12GB from Example PC today.", angle: "spec-led" },
      { title: "Aurora 12GB | Now $499 with Free Shipping", meta: "Buy the best 1440p graphics card.", angle: "deal" },
    ] });
    expect(good.facts.ok).toBe(true);
    expect(good.metaScore).toBeGreaterThan(bad.metaScore);
    expect(bad.facts.inventedNumbers).toEqual(["$499"]);
    expect(bad.facts.inventedClaims).toEqual(["free shipping"]);
  });

  it("scores a description before and after and checks required facts", () => {
    const d = scoreDescription({ ...input, kind: "description" }, {
      description: "The Aurora 12GB is a 1440p graphics card with 12 GB of GDDR6X memory and a 2,610 MHz boost clock. It's backed by a 3-year warranty and costs $549.",
      summary: "Answer-first lead.",
    }, ["$549", "3-year warranty"]);
    expect(d.facts.ok).toBe(true);
    expect(typeof d.seoBefore).toBe("number");
    expect(d.geoAfter).toBeGreaterThanOrEqual(0);
  });
});
