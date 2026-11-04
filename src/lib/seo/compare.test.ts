import { describe, expect, it } from "vitest";
import { comparePageChecks, compareSiteIssues } from "./compare";
import type { Check } from "./types";
import type { SiteIssue } from "./site-audit";

const c = (id: string, severity: Check["severity"]): Check => ({ id, severity, category: "meta", label: id, message: "", weight: 5 });
const i = (id: string, n: number): SiteIssue => ({ id, label: id, severity: "warn", description: "", fix: "", items: Array.from({ length: n }, (_, k) => ({ url: `u${k}` })) });

describe("comparePageChecks", () => {
  it("finds fixed, introduced and worsened checks", () => {
    const d = comparePageChecks(
      { score: 60, checks: [c("title", "fail"), c("meta", "warn"), c("h1", "pass"), c("alt", "warn"), c("gone", "warn")] },
      { score: 75, checks: [c("title", "pass"), c("meta", "warn"), c("h1", "fail"), c("alt", "fail")] },
    );
    expect(d.scoreDelta).toBe(15);
    expect(d.fixed.map((x) => x.id)).toEqual(["title", "gone"]);
    expect(d.introduced.map((x) => x.id)).toEqual(["h1"]);
    expect(d.worsened.map((x) => x.id)).toEqual(["alt"]);
  });
});

describe("compareSiteIssues", () => {
  it("finds resolved, added and changed issue types", () => {
    const d = compareSiteIssues([i("broken", 3), i("thin", 5), i("dupes", 2)], [i("thin", 2), i("dupes", 2), i("slow", 1)]);
    expect(d.resolved).toEqual([expect.objectContaining({ id: "broken", before: 3, after: 0 })]);
    expect(d.added).toEqual([expect.objectContaining({ id: "slow", before: 0, after: 1 })]);
    expect(d.changed).toEqual([expect.objectContaining({ id: "thin", before: 5, after: 2 })]);
  });
});
