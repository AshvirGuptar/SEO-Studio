import type { Check, ScoreSummary, Severity } from "./types";

const CREDIT: Record<Severity, number | null> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
  info: null, // informational checks don't affect the score
};

/** Weighted score: each scored check contributes weight * credit. */
export function summarize(checks: Check[]): ScoreSummary {
  let earned = 0;
  let possible = 0;
  const counts: Record<Severity, number> = { pass: 0, warn: 0, fail: 0, info: 0 };

  for (const c of checks) {
    counts[c.severity]++;
    const credit = CREDIT[c.severity];
    if (credit === null) continue;
    earned += c.weight * credit;
    possible += c.weight;
  }

  const score = possible === 0 ? 100 : Math.round((earned / possible) * 100);
  return { score, grade: gradeFor(score), counts };
}

export function gradeFor(score: number): ScoreSummary["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
