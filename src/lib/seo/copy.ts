/**
 * Rule-based analyzers for individual pieces of copy:
 * page titles, meta descriptions and product descriptions.
 * Used by the Content Optimizer tool and reused by the Page Analyzer.
 */
import type { Check } from "./types";
import {
  approxPixelWidth,
  containsPhrase,
  fleschReadingEase,
  keywordDensity,
  readabilityLabel,
  sentences,
  words,
} from "./text";

export const LIMITS = {
  titleMinChars: 30,
  titleMaxChars: 60,
  titleMaxPx: 580,
  metaMinChars: 120,
  metaMaxChars: 160,
  descriptionMinWords: 150,
  densityMin: 0.5,
  densityMax: 2.5,
  densityStuffing: 5,
} as const;

const POWER_WORDS = [
  "best", "free", "new", "guide", "easy", "fast", "official", "save", "top",
  "proven", "complete", "ultimate", "premium", "sale", "shop", "buy",
];

export function analyzeTitle(title: string, keyword?: string): Check[] {
  const t = title.trim();
  const checks: Check[] = [];
  const len = t.length;
  const px = approxPixelWidth(t);

  if (len === 0) {
    return [{
      id: "title-missing", category: "meta", label: "Title present", severity: "fail",
      weight: 10, message: "No title found.", fix: "Add a unique, descriptive title (30–60 characters).",
    }];
  }

  checks.push({
    id: "title-length", category: "meta", label: "Title length", weight: 8,
    value: `${len} chars · ~${px}px`,
    ...(len < LIMITS.titleMinChars
      ? { severity: "warn", message: "Title is short and may be under-using valuable space.", fix: `Aim for ${LIMITS.titleMinChars}–${LIMITS.titleMaxChars} characters.` }
      : len > LIMITS.titleMaxChars || px > LIMITS.titleMaxPx
        ? { severity: "warn", message: "Title will likely be truncated in Google results.", fix: `Trim to ≤${LIMITS.titleMaxChars} characters (~${LIMITS.titleMaxPx}px).` }
        : { severity: "pass", message: "Title length fits in search results." }),
  });

  if (keyword) {
    const has = containsPhrase(t, keyword);
    const idx = t.toLowerCase().indexOf(keyword.toLowerCase());
    checks.push({
      id: "title-keyword", category: "keywords", label: "Keyword in title", weight: 9,
      ...(!has
        ? { severity: "fail", message: `Title doesn't contain "${keyword}".`, fix: "Include the target keyword, ideally near the start." }
        : idx > t.length / 2
          ? { severity: "warn", message: "Keyword appears late in the title.", fix: "Move the keyword toward the front — front-loaded titles tend to perform better." }
          : { severity: "pass", message: "Keyword is present and front-loaded." }),
    });
  }

  const upperRatio = (t.match(/[A-Z]/g)?.length ?? 0) / Math.max(1, t.replace(/[^a-zA-Z]/g, "").length);
  if (upperRatio > 0.6 && len > 10) {
    checks.push({
      id: "title-caps", category: "meta", label: "Title casing", severity: "warn", weight: 3,
      message: "Title is mostly uppercase, which reads as spammy.", fix: "Use Title Case or sentence case.",
    });
  }

  const ws = words(t);
  const dupes = ws.filter((w, i) => w.length > 3 && ws.indexOf(w) !== i);
  if (dupes.length > 0) {
    checks.push({
      id: "title-repetition", category: "meta", label: "Repeated words", severity: "warn", weight: 3,
      message: `Repeated words: ${[...new Set(dupes)].join(", ")}.`, fix: "Avoid keyword stuffing; each word should earn its place.",
    });
  }

  const hasPower = POWER_WORDS.some((p) => ws.includes(p)) || /\d/.test(t);
  checks.push({
    id: "title-ctr", category: "meta", label: "Click appeal", weight: 2,
    ...(hasPower
      ? { severity: "pass", message: "Title includes a number or action/power word." }
      : { severity: "info", message: "Consider a number, year or benefit word to lift click-through rate." }),
  });

  return checks;
}

export function analyzeMetaDescription(meta: string, keyword?: string): Check[] {
  const m = meta.trim();
  const len = m.length;
  if (len === 0) {
    return [{
      id: "meta-missing", category: "meta", label: "Meta description present", severity: "fail",
      weight: 8, message: "No meta description found. Google will pick arbitrary page text.",
      fix: `Write a ${LIMITS.metaMinChars}–${LIMITS.metaMaxChars} character summary with a call to action.`,
    }];
  }
  const checks: Check[] = [{
    id: "meta-length", category: "meta", label: "Meta description length", weight: 6,
    value: `${len} chars`,
    ...(len < LIMITS.metaMinChars
      ? { severity: "warn", message: "Meta description is short.", fix: `Aim for ${LIMITS.metaMinChars}–${LIMITS.metaMaxChars} characters.` }
      : len > LIMITS.metaMaxChars
        ? { severity: "warn", message: "Meta description will be truncated.", fix: `Trim to ≤${LIMITS.metaMaxChars} characters.` }
        : { severity: "pass", message: "Meta description length is ideal." }),
  }];

  if (keyword) {
    checks.push({
      id: "meta-keyword", category: "keywords", label: "Keyword in meta description", weight: 5,
      ...(containsPhrase(m, keyword)
        ? { severity: "pass", message: "Keyword appears (Google bolds matching terms)." }
        : { severity: "warn", message: `Meta description doesn't mention "${keyword}".`, fix: "Work the keyword in naturally." }),
    });
  }

  const cta = /\b(shop|buy|learn|discover|get|try|find|explore|order|save|start|see|book|download)\b/i.test(m);
  checks.push({
    id: "meta-cta", category: "meta", label: "Call to action", weight: 2,
    ...(cta
      ? { severity: "pass", message: "Includes an action verb." }
      : { severity: "info", message: "Consider adding a call to action (Shop, Learn, Discover…)." }),
  });
  return checks;
}

export function analyzeBodyCopy(text: string, keyword?: string, opts?: { minWords?: number }): Check[] {
  const minWords = opts?.minWords ?? LIMITS.descriptionMinWords;
  const ws = words(text);
  const checks: Check[] = [];

  checks.push({
    id: "content-length", category: "content", label: "Word count", weight: 6,
    value: `${ws.length} words`,
    ...(ws.length >= minWords
      ? { severity: "pass", message: "Enough content for search engines to understand the topic." }
      : ws.length >= minWords / 2
        ? { severity: "warn", message: "Content is somewhat thin.", fix: `Expand to at least ${minWords} words with useful detail (features, use cases, FAQs).` }
        : { severity: "fail", message: "Content is thin.", fix: `Expand to at least ${minWords} words with useful detail.` }),
  });

  if (ws.length > 0) {
    const flesch = fleschReadingEase(text);
    checks.push({
      id: "readability", category: "readability", label: "Readability (Flesch)", weight: 4,
      value: `${flesch} · ${readabilityLabel(flesch)}`,
      ...(flesch >= 60
        ? { severity: "pass", message: "Easy to read for a general audience." }
        : flesch >= 40
          ? { severity: "warn", message: "Somewhat hard to read.", fix: "Use shorter sentences and simpler words." }
          : { severity: "fail", message: "Hard to read.", fix: "Break up long sentences; prefer common words." }),
    });

    const ss = sentences(text);
    const long = ss.filter((s) => words(s).length > 25).length;
    if (ss.length > 0) {
      const pct = Math.round((long / ss.length) * 100);
      checks.push({
        id: "sentence-length", category: "readability", label: "Long sentences", weight: 2,
        value: `${pct}% over 25 words`,
        ...(pct <= 25
          ? { severity: "pass", message: "Sentence length is comfortable." }
          : { severity: "warn", message: "Many sentences are long.", fix: "Keep most sentences under 20–25 words." }),
      });
    }
  }

  if (keyword && ws.length > 0) {
    const d = keywordDensity(text, keyword);
    const dStr = `${d.toFixed(2)}%`;
    checks.push({
      id: "keyword-density", category: "keywords", label: "Keyword density", weight: 5, value: dStr,
      ...(d === 0
        ? { severity: "fail", message: `"${keyword}" never appears in the copy.`, fix: "Use the keyword naturally a few times." }
        : d < LIMITS.densityMin
          ? { severity: "warn", message: "Keyword is used sparingly.", fix: `Target roughly ${LIMITS.densityMin}–${LIMITS.densityMax}%.` }
          : d > LIMITS.densityStuffing
            ? { severity: "fail", message: "Keyword stuffing: the keyword dominates the copy.", fix: "Rewrite for readers; use synonyms and related terms instead of repeating the keyword." }
          : d > LIMITS.densityMax
            ? { severity: "warn", message: "Keyword may be over-used (stuffing).", fix: "Replace some uses with synonyms or related terms." }
            : { severity: "pass", message: "Keyword density is in a healthy range." }),
    });

    const first100 = ws.slice(0, 100).join(" ");
    checks.push({
      id: "keyword-early", category: "keywords", label: "Keyword in first 100 words", weight: 4,
      ...(containsPhrase(first100, keyword)
        ? { severity: "pass", message: "Keyword appears early." }
        : { severity: "warn", message: "Keyword doesn't appear in the opening.", fix: "Mention the keyword in the first paragraph." }),
    });
  }

  return checks;
}
