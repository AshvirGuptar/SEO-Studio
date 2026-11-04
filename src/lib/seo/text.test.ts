import { describe, expect, it } from "vitest";
import { approxPixelWidth, countPhrase, fleschReadingEase, keywordDensity, syllables, topTerms, words } from "./text";

describe("text utils", () => {
  it("tokenizes words with apostrophes and hyphens", () => {
    expect(words("Don't stop — well-made shoes!")).toEqual(["don't", "stop", "well-made", "shoes"]);
  });
  it("counts multi-word phrases case-insensitively", () => {
    expect(countPhrase("Running shoes are great. RUNNING SHOES for all.", "running shoes")).toBe(2);
    expect(countPhrase("shoes running", "running shoes")).toBe(0);
  });
  it("matches across hyphenated spellings", () => {
    expect(countPhrase("AR-15 Charging Handle for M-LOK rails", "ar15 charging handle")).toBe(1);
    expect(countPhrase("mlok handguard", "m-lok handguard")).toBe(1);
  });
  it("computes keyword density", () => {
    expect(keywordDensity("red shoe blue shoe", "shoe")).toBe(50);
  });
  it("counts syllables roughly", () => {
    expect(syllables("cat")).toBe(1);
    expect(syllables("table")).toBe(2);
    expect(syllables("optimization")).toBeGreaterThanOrEqual(4);
  });
  it("scores simple text as easier than complex text", () => {
    const easy = fleschReadingEase("The cat sat on the mat. It was fun.");
    const hard = fleschReadingEase("Comprehensive organizational infrastructure optimization necessitates considerable interdepartmental collaboration.");
    expect(easy).toBeGreaterThan(hard);
  });
  it("ranks top terms without stop words", () => {
    expect(topTerms("the shoe and the shoe and the sock")[0]).toEqual({ term: "shoe", count: 2 });
  });
  it("estimates wider pixel width for wide letters", () => {
    expect(approxPixelWidth("WWWW")).toBeGreaterThan(approxPixelWidth("iiii"));
  });
});
