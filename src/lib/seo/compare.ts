/** "What changed" between two saved audits of the same URL (pure). */
import type { Check } from "./types";
import type { SiteIssue } from "./site-audit";

const isIssue = (c: Check) => c.severity === "fail" || c.severity === "warn";

export interface PageDiff {
  scoreDelta: number;
  fixed: Check[]; // was an issue, now passing/absent
  introduced: Check[]; // wasn't an issue, now is
  worsened: Check[]; // warn -> fail
}

export function comparePageChecks(prev: { score: number; checks: Check[] }, curr: { score: number; checks: Check[] }): PageDiff {
  const before = new Map(prev.checks.map((c) => [c.id, c]));
  const after = new Map(curr.checks.map((c) => [c.id, c]));
  const fixed: Check[] = [];
  const introduced: Check[] = [];
  const worsened: Check[] = [];
  for (const [id, b] of before) {
    const a = after.get(id);
    if (isIssue(b) && (!a || !isIssue(a))) fixed.push(b);
  }
  for (const [id, a] of after) {
    const b = before.get(id);
    if (isIssue(a) && (!b || !isIssue(b))) introduced.push(a);
    else if (b && b.severity === "warn" && a.severity === "fail") worsened.push(a);
  }
  return { scoreDelta: curr.score - prev.score, fixed, introduced, worsened };
}

export interface SiteIssueDelta {
  id: string;
  label: string;
  severity: SiteIssue["severity"];
  before: number;
  after: number;
}

export function compareSiteIssues(prev: SiteIssue[], curr: SiteIssue[]): { resolved: SiteIssueDelta[]; added: SiteIssueDelta[]; changed: SiteIssueDelta[] } {
  const b = new Map(prev.map((i) => [i.id, i]));
  const a = new Map(curr.map((i) => [i.id, i]));
  const resolved: SiteIssueDelta[] = [];
  const added: SiteIssueDelta[] = [];
  const changed: SiteIssueDelta[] = [];
  for (const [id, i] of b) {
    if (!a.has(id)) resolved.push({ id, label: i.label, severity: i.severity, before: i.items.length, after: 0 });
  }
  for (const [id, i] of a) {
    const old = b.get(id);
    if (!old) added.push({ id, label: i.label, severity: i.severity, before: 0, after: i.items.length });
    else if (old.items.length !== i.items.length) changed.push({ id, label: i.label, severity: i.severity, before: old.items.length, after: i.items.length });
  }
  return { resolved, added, changed };
}
