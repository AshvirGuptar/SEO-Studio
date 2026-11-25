/**
 * AI rewrite evaluation over docs/eval/cases.json.
 *   npm run eval:baseline   free: scores the original copy only, writes docs/eval/baseline.md
 *   npm run eval            spends API credits: rewrites every case (EVAL_CONFIRM=1 required),
 *                           writes docs/eval/results/<date>-<model>.md and .csv
 * Options: EVAL_LIMIT=5 (first N cases), AI_MODEL=claude-haiku-5-5 (cheaper test run).
 * Uses exactly the app's prompts, schemas, scoring and fact check (src/lib/ai/rewrite.ts).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "vitest";
import { summarize } from "@/lib/seo/score";
import { analyzeBodyCopy, analyzeMetaDescription, analyzeTitle } from "@/lib/seo/copy";
import { analyzeCopyGeo } from "@/lib/seo/specs";
import {
  buildRewritePrompt, DESCRIPTION_SCHEMA, DescriptionResult, REWRITE_ESTIMATE_MICROS, REWRITE_SYSTEM, scoreDescription,
  scoreTitleMeta, TITLE_META_SCHEMA, TitleMetaResult, type RewriteInput,
} from "@/lib/ai/rewrite";
import { formatUsd } from "@/lib/ai/pricing";
import { aiModel } from "@/lib/ai/config";

interface Case { id: string; type: "product" | "category" | "blog"; keyword: string; url: string; title: string; meta: string; body: string; specs: string; facts: string[]; notes: string }

const DIR = new URL(".", import.meta.url);
const cases: Case[] = JSON.parse(readFileSync(new URL("cases.json", DIR), "utf8"));
const MIN_WORDS = { product: 150, category: 250, blog: 800 } as const;
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

function before(c: Case) {
  const kw = c.keyword || undefined;
  return {
    title: summarize(analyzeTitle(c.title, kw)).score,
    meta: summarize(analyzeMetaDescription(c.meta, kw)).score,
    body: summarize(analyzeBodyCopy(c.body, kw, { minWords: MIN_WORDS[c.type] })).score,
    geo: summarize(analyzeCopyGeo(c.body, c.specs)).score,
  };
}

const mode = process.env.EVAL_MODE ?? "baseline";

test.runIf(mode === "baseline")("baseline: score the original copy (no API calls)", () => {
  const rows = cases.map((c) => ({ c, s: before(c) }));
  const lines = [
    "# Evaluation baseline (original copy, before any rewrite)",
    "",
    `${cases.length} cases (${["product", "category", "blog"].map((t) => `${cases.filter((c) => c.type === t).length} ${t}`).join(", ")}). Scores are 0–100 from the app's own engine.`,
    "Regenerate with `npm run eval:baseline`.",
    "",
    `**Averages:** title ${avg(rows.map((r) => r.s.title))} · meta ${avg(rows.map((r) => r.s.meta))} · description SEO ${avg(rows.map((r) => r.s.body))} · description GEO ${avg(rows.map((r) => r.s.geo))}`,
    "",
    "| Case | Type | Title | Meta | Description SEO | Description GEO |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(({ c, s }) => `| ${c.id} | ${c.type} | ${s.title} | ${s.meta} | ${s.body} | ${s.geo} |`),
    "",
  ];
  writeFileSync(new URL("baseline.md", DIR), lines.join("\n"));
  console.log(lines.slice(0, 6).join("\n"));
});

test.runIf(mode === "rewrite")("rewrite: run every case through Claude and score it", async () => {
  const limit = Number(process.env.EVAL_LIMIT) || cases.length;
  const list = cases.slice(0, limit);
  const model = aiModel();
  const estimate = list.length * 2 * REWRITE_ESTIMATE_MICROS;
  console.log(`${list.length} cases × 2 rewrites on ${model}: up to about ${formatUsd(estimate)}.`);
  if (process.env.EVAL_CONFIRM !== "1") {
    throw new Error(`This spends real API credits (up to about ${formatUsd(estimate)}). Re-run with EVAL_CONFIRM=1 once a teammate has agreed.`);
  }
  const { callClaudeJson, parseJsonAnswer } = await import("@/lib/ai/generate");

  const results: string[][] = [];
  const csv: string[][] = [["case", "type", "title_before", "title_after", "meta_before", "meta_after", "desc_seo_before", "desc_seo_after", "desc_geo_before", "desc_geo_after", "title_meta_facts_ok", "desc_facts_ok", "fact_issues", "cost_usd", "new_title", "new_meta", "human_rating_1_to_5"]];
  const gains = { title: [] as number[], meta: [] as number[], seo: [] as number[], geo: [] as number[] };
  let factPasses = 0, factTotal = 0, totalCost = 0, failures = 0;

  for (const c of list) {
    const base: Omit<RewriteInput, "kind"> = { keyword: c.keyword, title: c.title, meta: c.meta, body: c.body, specs: c.specs, preset: c.type, tone: "clear" };
    const b = before(c);
    try {
      const tmIn: RewriteInput = { ...base, kind: "title-meta" };
      const tm = await callClaudeJson({ system: REWRITE_SYSTEM, prompt: buildRewritePrompt(tmIn), schema: TITLE_META_SCHEMA, effort: "medium", maxTokens: 6000 });
      const scored = scoreTitleMeta(tmIn, parseJsonAnswer(tm.message, TitleMetaResult));
      // The variant a person would most likely pick: facts kept first, then the best combined score.
      const best = [...scored].sort((x, y) => Number(y.facts.ok) - Number(x.facts.ok) || (y.titleScore + y.metaScore) - (x.titleScore + x.metaScore))[0];

      const dIn: RewriteInput = { ...base, kind: "description" };
      const d = await callClaudeJson({ system: REWRITE_SYSTEM, prompt: buildRewritePrompt(dIn), schema: DESCRIPTION_SCHEMA, effort: "medium", maxTokens: 10000 });
      const bodyFacts = c.facts.filter((f) => c.body.includes(f));
      const desc = scoreDescription(dIn, parseJsonAnswer(d.message, DescriptionResult), bodyFacts);

      const cost = tm.cost + d.cost;
      totalCost += cost;
      factTotal += scored.length + 1;
      factPasses += scored.filter((v) => v.facts.ok).length + (desc.facts.ok ? 1 : 0);
      gains.title.push(best.titleScore - b.title); gains.meta.push(best.metaScore - b.meta);
      gains.seo.push(desc.seoAfter - b.body); gains.geo.push(desc.geoAfter - b.geo);
      const issues = [...scored.filter((v) => !v.facts.ok).map(() => "title/meta"), ...(desc.facts.ok ? [] : ["description"])].join("; ");
      results.push([c.id, `${b.title}→${best.titleScore}`, `${b.meta}→${best.metaScore}`, `${b.body}→${desc.seoAfter}`, `${b.geo}→${desc.geoAfter}`, best.facts.ok && desc.facts.ok ? "✓" : "⚠", formatUsd(cost, 3)]);
      csv.push([c.id, c.type, String(b.title), String(best.titleScore), String(b.meta), String(best.metaScore), String(b.body), String(desc.seoAfter), String(b.geo), String(desc.geoAfter), String(best.facts.ok), String(desc.facts.ok), issues, (cost / 1e6).toFixed(4), best.title, best.meta, ""]);
      console.log(`${c.id}: title ${sign(best.titleScore - b.title)}, description SEO ${sign(desc.seoAfter - b.body)}, facts ${best.facts.ok && desc.facts.ok ? "kept" : "ISSUE"}`);
    } catch (e) {
      failures++;
      results.push([c.id, "error", "", "", "", "", ""]);
      console.error(`${c.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(new URL("results/", DIR), { recursive: true });
  const name = `${date}-${model}`;
  const rewrites = (list.length - failures) * 2;
  const md = [
    `# AI rewrite evaluation: ${date} on ${model}`,
    "",
    `${list.length} cases, ${failures} failed. Tone: clear. Best title/meta variant = facts kept first, then highest score.`,
    "",
    `- **Average score change:** title ${sign(avg(gains.title))}, meta ${sign(avg(gains.meta))}, description SEO ${sign(avg(gains.seo))}, description GEO ${sign(avg(gains.geo))}`,
    `- **Fact preservation:** ${factPasses}/${factTotal} suggestions kept every fact (${factTotal ? Math.round((factPasses / factTotal) * 100) : 0}%)`,
    `- **Cost:** ${formatUsd(totalCost)} total, ${formatUsd(rewrites ? totalCost / rewrites : 0, 3)} per rewrite`,
    `- **Human ratings:** fill in the last column of ${name}.csv (1–5), then add the average here.`,
    "",
    "| Case | Title | Meta | Description SEO | Description GEO | Facts | Cost |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...results.map((r) => `| ${r.join(" | ")} |`),
    "",
  ].join("\n");
  writeFileSync(new URL(`results/${name}.md`, DIR), md);
  writeFileSync(new URL(`results/${name}.csv`, DIR), csv.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n");
  console.log(md.split("\n").slice(0, 8).join("\n"));
});
