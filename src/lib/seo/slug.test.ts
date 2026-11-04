import { describe, expect, it } from "vitest";
import { analyzeUrl, slugify, suggestUrl } from "./slug";

const byId = (checks: ReturnType<typeof analyzeUrl>, id: string) => checks.find((c) => c.id === id);

describe("slugify", () => {
  it("lowercases, strips accents, stop words and punctuation", () => {
    expect(slugify("The Best Café Chairs & Tables for Your Home!")).toBe("best-cafe-chairs-tables-home");
  });
  it("can keep stop words", () => {
    expect(slugify("Shoes for Kids", { removeStopWords: false })).toBe("shoes-for-kids");
  });
  it("limits word count and removes duplicates", () => {
    expect(slugify("shoe shoe one two three four five six seven")).toBe("shoe-one-two-three-four-five");
  });
});

describe("analyzeUrl", () => {
  it("flags uppercase, underscores and missing keyword", () => {
    const checks = analyzeUrl("http://example.com/Products/Red_Shoes?id=1", "running shoes");
    expect(byId(checks, "url-https")?.severity).toBe("fail");
    expect(byId(checks, "url-case")?.severity).toBe("warn");
    expect(byId(checks, "url-underscores")?.severity).toBe("warn");
    expect(byId(checks, "url-keyword")?.severity).toBe("warn");
  });
  it("passes a clean URL", () => {
    const checks = analyzeUrl("https://example.com/shoes/running-shoes", "running shoes");
    expect(checks.every((c) => c.severity === "pass" || c.severity === "info")).toBe(true);
  });
});

describe("suggestUrl", () => {
  it("keeps host and parents and inserts the keyword", () => {
    expect(suggestUrl("https://shop.com/Products/item_12345.html", { keyword: "red sneakers" }))
      .toBe("https://shop.com/products/red-sneakers-item");
  });
  it("uses the title when provided", () => {
    expect(suggestUrl("/blog/p?id=3", { title: "How to Choose Running Shoes" })).toBe("/blog/how-choose-running-shoes");
  });
});
