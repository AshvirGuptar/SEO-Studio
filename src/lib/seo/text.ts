/** Text utilities: tokenizing, keyword counting, readability. No dependencies. */

export const STOP_WORDS = new Set(
  (
    "a an and are as at be but by for from has have he her his i in is it its " +
    "of on or our she that the their them they this to was we were what when " +
    "where which who will with you your"
  ).split(" "),
);

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function words(text: string): string[] {
  return normalize(text).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
}

/**
 * Token form used for matching: ignores hyphens/apostrophes inside words, so "wi-fi" matches
 * "wifi", "usb-c" matches "usbc" and "women's" matches "womens".
 */
export function matchToken(w: string): string {
  return w.replace(/['’-]/g, "");
}

/** Counts non-overlapping occurrences of a (possibly multi-word) phrase. */
export function countPhrase(text: string, phrase: string): number {
  const hay = words(text).map(matchToken);
  const needle = words(phrase).map(matchToken);
  if (needle.length === 0 || hay.length < needle.length) return 0;
  let count = 0;
  for (let i = 0; i <= hay.length - needle.length; i++) {
    if (needle.every((w, j) => hay[i + j] === w)) {
      count++;
      i += needle.length - 1;
    }
  }
  return count;
}

export function containsPhrase(text: string, phrase: string): boolean {
  return countPhrase(text, phrase) > 0;
}

/** Keyword density as a percentage of total words (phrase words counted). */
export function keywordDensity(text: string, phrase: string): number {
  const total = words(text).length;
  if (total === 0) return 0;
  const n = countPhrase(text, phrase) * words(phrase).length;
  return (n / total) * 100;
}

/** Heuristic syllable counter, good enough for Flesch scoring. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/** Flesch Reading Ease (0-100+, higher = easier). */
export function fleschReadingEase(text: string): number {
  const ws = words(text);
  const ss = sentences(text);
  if (ws.length === 0 || ss.length === 0) return 0;
  const syl = ws.reduce((n, w) => n + syllables(w), 0);
  const score = 206.835 - 1.015 * (ws.length / ss.length) - 84.6 * (syl / ws.length);
  return Math.round(score * 10) / 10;
}

export function readabilityLabel(flesch: number): string {
  if (flesch >= 80) return "Very easy";
  if (flesch >= 60) return "Plain English";
  if (flesch >= 50) return "Fairly difficult";
  if (flesch >= 30) return "Difficult";
  return "Very difficult";
}

/** Top n non-stop-word terms by frequency. */
export function topTerms(text: string, n = 10): { term: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const w of words(text)) {
    if (w.length < 3 || STOP_WORDS.has(w) || /^\d+$/.test(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([term, count]) => ({ term, count }));
}

/**
 * Approximate rendered pixel width of text in Google's SERP title font
 * (Arial ~20px). Google truncates titles around 580-600px.
 */
export function approxPixelWidth(text: string, fontPx = 20): number {
  let units = 0;
  for (const ch of text) {
    if ("iIl.,;:'|!j ".includes(ch)) units += 0.28;
    else if ("ftr()[]-".includes(ch)) units += 0.36;
    else if ("mwMW@".includes(ch)) units += 0.85;
    else if (ch >= "A" && ch <= "Z") units += 0.66;
    else units += 0.54;
  }
  return Math.round(units * fontPx);
}
