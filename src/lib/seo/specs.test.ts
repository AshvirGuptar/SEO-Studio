import { describe, expect, it } from "vitest";
import { analyzeCopyGeo, analyzeSpecs, parseSpecs } from "./specs";
import { summarize } from "./score";

const SPECS = `Weight: 1.1 kg (pair)
Color: Brown, Black
Sizes: US 7–13
Material - Full-grain leather
Waterproofing\tGore-Tex membrane
Height | 15 cm
Warranty: 2 years`;

const byId = (checks: ReturnType<typeof analyzeSpecs>) => Object.fromEntries(checks.map((c) => [c.id, c.severity]));

describe("parseSpecs", () => {
  it("accepts colon, tab, pipe and dash separators; keeps unstructured lines aside", () => {
    const { specs, unstructured } = parseSpecs(SPECS + "\nGreat for hiking all day long");
    expect(specs).toHaveLength(7);
    expect(specs[3]).toEqual({ label: "Material", value: "Full-grain leather" });
    expect(specs[4]).toEqual({ label: "Waterproofing", value: "Gore-Tex membrane" });
    expect(unstructured).toEqual(["Great for hiking all day long"]);
  });
});

describe("analyzeSpecs", () => {
  it("passes a complete, structured spec list", () => {
    const checks = analyzeSpecs(SPECS, { keyword: "hiking boots", preset: "product" });
    expect(byId(checks)).toMatchObject({ "specs-count": "pass", "specs-structured": "pass", "specs-units": "pass", "specs-key-attributes": "pass" });
  });
  it("flags thin, messy specs without units", () => {
    const checks = analyzeSpecs("Weight 500\nreally comfy\nColor: red", { preset: "product" });
    const ids = byId(checks);
    expect(ids["specs-count"]).toBe("warn");
    expect(ids["specs-structured"]).toBe("warn");
    expect(checks.filter((c) => c.severity === "warn").every((c) => c.fix)).toBe(true);
  });
  it("returns nothing when specs are empty (field is optional)", () => {
    expect(analyzeSpecs("  \n ")).toEqual([]);
  });
});

describe("analyzeCopyGeo", () => {
  it("rewards an answer-first body plus structured specs", () => {
    const body = "The TrailCo Summit is a waterproof hiking boot for wet, rocky day hikes, weighing 1.1 kg per pair with a 2 year warranty.\n\nMore detail follows here.";
    const checks = analyzeCopyGeo(body, SPECS);
    expect(Object.fromEntries(checks.map((c) => [c.id, c.severity]))).toMatchObject({
      "geo-copy-lead": "pass", "geo-copy-facts": "pass", "geo-specs-structured": "pass", "geo-specs-html": "info",
    });
    expect(summarize(checks).score).toBeGreaterThanOrEqual(90);
  });
  it("adding specs raises the GEO score", () => {
    const body = "A comfortable boot for hiking that you will love on every trail you take this season and beyond.";
    expect(summarize(analyzeCopyGeo(body, SPECS)).score).toBeGreaterThan(summarize(analyzeCopyGeo(body, "")).score);
  });
});
