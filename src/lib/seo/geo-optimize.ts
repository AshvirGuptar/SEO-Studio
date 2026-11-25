/**
 * GEO Optimization engine (pure, runs in the browser): reads a page draft written in simple Markdown
 * ("# Heading", blank-line paragraphs, "- " lists, "| a | b |" tables), scores it with the same
 * answer-ready checks the Page Analyzer runs on live HTML, finds Q&A pairs for FAQ markup, and diffs
 * two drafts block by block for the side-by-side review.
 */
import type { Check } from "./types";
import { analyzeAnswerReady, isQuestion, type AnswerStructure } from "./geo";
import { analyzeCopyGeo } from "./specs";
import { words } from "./text";

export type DraftBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; rows: string[][] };

export interface ParsedDraft {
  blocks: DraftBlock[];
  structure: AnswerStructure;
  /** The draft as plain text (no Markdown markers), for fact and keyword checks. */
  plainText: string;
}

export const DRAFT_LIMITS = {
  /** A lone line ending in "?" up to this many words reads as a question heading in pasted copy. */
  bareQuestionMaxWords: 20,
  /** Lists need this many items to count (matches extract.ts). */
  minListItems: 3,
} as const;

const HEADING = /^(#{1,4})\s+(.+?)\s*#*$/;
const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** Same word count extract.ts uses for HTML, so a draft and the published page get the same numbers. */
const wc = (t: string) => (t.match(/[\p{L}\p{N}]+/gu) ?? []).length;

const clean = (s: string) => s.replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();

/** Splits a draft into headings, paragraphs, lists and tables. */
export function parseDraft(text: string): ParsedDraft {
  const blocks: DraftBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let table: string[][] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", text: clean(para.join(" ")) });
    if (list.length) blocks.push({ type: "list", items: list });
    if (table.length) blocks.push({ type: "table", rows: table });
    para = []; list = []; table = [];
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = line.match(HEADING);
    if (h) { flush(); blocks.push({ type: "heading", level: h[1].length, text: clean(h[2]) }); continue; }
    if (TABLE_RULE.test(line) && table.length) continue;
    const t = line.match(TABLE_ROW);
    if (t) {
      if (para.length || list.length) flush();
      table.push(t[1].split("|").map((c) => clean(c)));
      continue;
    }
    const li = line.match(LIST_ITEM);
    if (li) {
      if (para.length || table.length) flush();
      list.push(clean(li[1]));
      continue;
    }
    // Pasted copy often loses heading markup: a short line ending in "?" on its own is a question heading.
    if (!para.length && /\?\s*$/.test(line) && words(line).length <= DRAFT_LIMITS.bareQuestionMaxWords) {
      flush();
      blocks.push({ type: "heading", level: 2, text: clean(line) });
      continue;
    }
    if (list.length || table.length) flush();
    para.push(line);
  }
  flush();
  return { blocks, structure: structureOf(blocks), plainText: blocksToText(blocks) };
}

function blockWords(b: DraftBlock): number {
  if (b.type === "heading" || b.type === "paragraph") return wc(b.text);
  if (b.type === "list") return b.items.reduce((n, i) => n + wc(i), 0);
  return b.rows.reduce((n, r) => n + r.reduce((m, c) => m + wc(c), 0), 0);
}

/** The same structure extract.ts derives from HTML, so analyzeAnswerReady judges drafts and pages alike. */
function structureOf(blocks: DraftBlock[]): AnswerStructure {
  const paragraphWordCounts = blocks.flatMap((b) => (b.type === "paragraph" ? [wc(b.text)] : []));
  const sections: AnswerStructure["sections"] = [];
  blocks.forEach((b, i) => {
    if (b.type !== "heading") return;
    let first = 0;
    let total = 0;
    for (let j = i + 1; j < blocks.length && blocks[j].type !== "heading"; j++) {
      const next = blocks[j];
      if (!first && next.type === "paragraph") first = wc(next.text);
      total += blockWords(next);
    }
    sections.push({ level: b.level, heading: b.text, firstParagraphWords: first, words: total });
  });
  return {
    sections,
    firstParagraphWords: paragraphWordCounts[0] ?? 0,
    paragraphWordCounts,
    lists: blocks.filter((b) => b.type === "list" && b.items.length >= DRAFT_LIMITS.minListItems).length,
    tables: blocks.filter((b) => b.type === "table").length,
  };
}

export function blocksToText(blocks: DraftBlock[]): string {
  return blocks
    .map((b) => (b.type === "list" ? b.items.join("\n") : b.type === "table" ? b.rows.map((r) => r.join(" ")).join("\n") : b.text))
    .join("\n\n");
}

/**
 * GEO checks for a draft: the Page Analyzer's answer-ready checks plus the Content Optimizer's
 * "concrete facts" check. Crawler access, schema and trust signals live outside the copy, so the
 * schema builder and AI access kit cover those.
 */
export function analyzeDraftGeo(text: string): Check[] {
  if (!text.trim()) return [];
  const { structure, plainText } = parseDraft(text);
  const facts = analyzeCopyGeo(plainText, "").filter((c) => c.id === "geo-copy-facts");
  return [...analyzeAnswerReady(structure), ...facts];
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** Q&A pairs already in the draft: each question heading with the paragraphs under it. */
export function extractFaqs(text: string): FaqItem[] {
  const { blocks } = parseDraft(text);
  const out: FaqItem[] = [];
  blocks.forEach((b, i) => {
    if (b.type !== "heading" || b.level < 2 || !isQuestion(b.text)) return;
    const parts: string[] = [];
    for (let j = i + 1; j < blocks.length && blocks[j].type !== "heading"; j++) {
      const next = blocks[j];
      if (next.type === "paragraph") parts.push(next.text);
      else if (next.type === "list") parts.push(next.items.join("; "));
    }
    if (parts.length) out.push({ question: b.text, answer: parts.join(" ") });
  });
  return out;
}

// ---------- Side-by-side diff ----------

export type DiffRow =
  | { kind: "same"; before: string; after: string }
  | { kind: "changed"; before: string; after: string }
  | { kind: "removed"; before: string }
  | { kind: "added"; after: string };

/** Longest-common-subsequence alignment of two sequences: "=" keep, "-" only in a, "+" only in b. */
export function lcsOps<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x, y) => x === y): ("=" | "-" | "+")[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops: ("=" | "-" | "+")[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { ops.push("="); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push("-"); i++; }
    else { ops.push("+"); j++; }
  }
  while (i++ < n) ops.push("-");
  while (j++ < m) ops.push("+");
  return ops;
}

/** Splits a draft into the units the reviewer compares: one per paragraph, heading, list or table. */
export function draftUnits(text: string): string[] {
  return text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Block-level side-by-side diff. Runs of removed + added blocks are paired up as "changed" rows,
 * so a rewritten paragraph sits next to its original.
 */
export function diffDrafts(before: string, after: string): DiffRow[] {
  const a = draftUnits(before);
  const b = draftUnits(after);
  const ops = lcsOps(a, b, (x, y) => norm(x) === norm(y));
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  let removed: string[] = [];
  let added: string[] = [];
  const flush = () => {
    const pairs = Math.min(removed.length, added.length);
    for (let k = 0; k < pairs; k++) rows.push({ kind: "changed", before: removed[k], after: added[k] });
    for (const r of removed.slice(pairs)) rows.push({ kind: "removed", before: r });
    for (const r of added.slice(pairs)) rows.push({ kind: "added", after: r });
    removed = []; added = [];
  };
  for (const op of ops) {
    if (op === "=") { flush(); rows.push({ kind: "same", before: a[i++], after: b[j++] }); }
    else if (op === "-") removed.push(a[i++]);
    else added.push(b[j++]);
  }
  flush();
  return rows;
}

/** Word-level diff inside a changed row, for highlighting: each part is kept, removed or added. */
export function diffWords(before: string, after: string): { text: string; op: "=" | "-" | "+" }[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  const ops = lcsOps(a, b);
  const out: { text: string; op: "=" | "-" | "+" }[] = [];
  let i = 0;
  let j = 0;
  for (const op of ops) {
    const text = op === "+" ? b[j++] : a[i++];
    if (op === "=") j++;
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ text, op });
  }
  return out;
}
