/**
 * Shared types for every SEO analyzer in SEO & GEO Studio.
 * Every analyzer returns Check[] so the UI can render any of them the same way.
 */

export type Severity = "pass" | "warn" | "fail" | "info";

export type CheckCategory =
  | "meta"
  | "content"
  | "headings"
  | "keywords"
  | "links"
  | "images"
  | "technical"
  | "social"
  | "url"
  | "readability"
  // GEO (generative engine optimization) categories
  | "ai-access"
  | "answer-ready"
  | "trust"
  | "entity";

export interface Check {
  /** Stable machine id, e.g. "title-length". Used for tests and history diffs. */
  id: string;
  category: CheckCategory;
  label: string;
  severity: Severity;
  /** Human explanation of what we found. */
  message: string;
  /** What to do about it (omitted when passing). */
  fix?: string;
  /** Relative importance 1-10. Drives the overall score. */
  weight: number;
  /** Optional raw value for display (e.g. "58 chars"). */
  value?: string;
}

export interface ScoreSummary {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  counts: Record<Severity, number>;
}
