import { describe, expect, it } from "vitest";
import { analyzeDraftGeo, diffDrafts, diffWords, extractFaqs, lcsOps, parseDraft } from "./geo-optimize";
import { analyzeGeo } from "./geo";
import { extractFacts } from "./extract";
import { summarize } from "./score";

const byId = (checks: { id: string }[], id: string) => checks.find((c) => c.id === id) as { severity: string } | undefined;

const WALL = `Our hiking boots are made for people who walk a lot and want comfortable feet on long trails in every season of the year, with
a lot of features we are proud of and many details that we think you will love once you try them for yourself on the trail and at home, and we have been making them for a long time in our workshop. Every pair is stitched by hand, checked twice, and packed with care before it ships to you so that it arrives ready for the next adventure.

They weigh 1.1 kg per pair and cost $120. The waterproof membrane keeps feet dry for 8 hours of rain.`;

const ANSWER_FIRST = `# Hiking boots for long trails

Our mid-cut hiking boots keep feet dry and supported on long trails. They weigh 1.1 kg per pair and cost $120.

## How should hiking boots fit?

Hiking boots should leave about 1 cm of space in front of your toes, hold your heel firmly without slipping, and feel snug but not tight across the widest part of your foot when laced up for the trail.

- Try them on in the afternoon
- Wear hiking socks
- Walk downhill on a ramp

## Are they waterproof?

Yes. The waterproof membrane keeps feet dry for 8 hours of steady rain, which covers most day hikes, stream crossings and wet spring trails without needing gaiters or a spare pair of socks in your pack.

| Spec | Value |
| --- | --- |
| Weight | 1.1 kg |`;

describe("parseDraft", () => {
  it("reads headings, paragraphs, lists and tables", () => {
    const { blocks, structure } = parseDraft(ANSWER_FIRST);
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "heading", "paragraph", "list", "heading", "paragraph", "table"]);
    expect(structure.lists).toBe(1);
    expect(structure.tables).toBe(1);
    expect(structure.sections.filter((s) => s.level === 2).map((s) => s.heading)).toEqual(["How should hiking boots fit?", "Are they waterproof?"]);
    expect(structure.firstParagraphWords).toBe(23);
  });

  it("treats a short lone question line as a heading in pasted copy", () => {
    const { blocks } = parseDraft("Intro text here.\n\nDo they run small?\nNo, they run true to size for most people.");
    expect(blocks[1]).toEqual({ type: "heading", level: 2, text: "Do they run small?" });
  });

  it("matches what extract.ts finds in the same content as HTML", () => {
    const html = `<html><body><h1>Hiking boots for long trails</h1><p>Our mid-cut hiking boots keep feet dry and supported on long trails. They weigh 1.1 kg per pair and cost $120.</p>
<h2>How should hiking boots fit?</h2><p>Hiking boots should leave about 1 cm of space in front of your toes, hold your heel firmly without slipping, and feel snug but not tight across the widest part of your foot when laced up for the trail.</p></body></html>`;
    const fromHtml = extractFacts(html).geo;
    const fromDraft = parseDraft(ANSWER_FIRST.split("\n- Try")[0]).structure;
    expect(fromDraft.sections.map((s) => [s.heading, s.firstParagraphWords])).toEqual(fromHtml.sections.map((s) => [s.heading, s.firstParagraphWords]));
  });
});

describe("analyzeDraftGeo", () => {
  it("scores an answer-first draft above a wall of text, using the Page Analyzer's check ids", () => {
    const before = analyzeDraftGeo(WALL);
    const after = analyzeDraftGeo(ANSWER_FIRST);
    expect(byId(before, "geo-question-headings")?.severity).toBe("warn");
    expect(byId(before, "geo-summary-lead")?.severity).toBe("warn");
    expect(byId(after, "geo-question-headings")?.severity).toBe("pass");
    expect(byId(after, "geo-direct-answers")?.severity).toBe("pass");
    expect(byId(after, "geo-summary-lead")?.severity).toBe("pass");
    expect(byId(after, "geo-lists-tables")?.severity).toBe("pass");
    expect(byId(after, "geo-copy-facts")).toBeDefined();
    expect(summarize(after).score).toBeGreaterThan(summarize(before).score);
  });

  it("returns nothing for an empty draft", () => {
    expect(analyzeDraftGeo("  ")).toEqual([]);
  });

  it("keeps analyzeGeo's answer-ready checks unchanged after the refactor", () => {
    const { checks } = analyzeGeo(extractFacts("<html><body><h1>x</h1><p>short</p></body></html>"));
    expect(checks.map((c) => c.id)).toEqual(expect.arrayContaining(["geo-question-headings", "geo-summary-lead", "geo-lists-tables"]));
  });
});

describe("extractFaqs", () => {
  it("pairs question headings with the text under them", () => {
    const faqs = extractFaqs(ANSWER_FIRST);
    expect(faqs.map((f) => f.question)).toEqual(["How should hiking boots fit?", "Are they waterproof?"]);
    expect(faqs[0].answer).toMatch(/^Hiking boots should leave about 1 cm.*Walk downhill on a ramp$/);
  });
  it("ignores the H1 and non-question headings", () => {
    expect(extractFaqs("# What is this?\n\nText.\n\n## Specs\n\nWeight 1 kg.")).toEqual([]);
  });
});

describe("diff", () => {
  it("aligns with LCS", () => {
    expect(lcsOps(["a", "b", "c"], ["a", "x", "c"])).toEqual(["=", "-", "+", "="]);
  });
  it("pairs rewritten blocks side by side and keeps unchanged ones", () => {
    const rows = diffDrafts("# Title\n\nOld intro.\n\nSame para.", "# Title\n\nNew intro.\n\n## Why?\n\nSame para.");
    expect(rows.map((r) => r.kind)).toEqual(["same", "changed", "added", "same"]);
    expect(rows[1]).toEqual({ kind: "changed", before: "Old intro.", after: "New intro." });
  });
  it("highlights changed words", () => {
    expect(diffWords("costs $120 today", "costs $99 today")).toEqual([
      { text: "costs ", op: "=" }, { text: "$120", op: "-" }, { text: "$99", op: "+" }, { text: " today", op: "=" },
    ]);
  });
});
