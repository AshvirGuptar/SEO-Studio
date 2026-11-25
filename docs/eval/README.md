# AI rewrite evaluation set

Measures whether AI rewrites (Content Optimizer → AI rewrite, and later GEO Optimization) actually
improve copy **without changing facts**. Prompt changes are checked against this set before merging.

## What's here
- `cases.json`: 30 realistic page-copy cases (14 product, 9 category, 7 blog; 4 for the "Example PC"
  demo store, the rest fictional brands across 10+ industries). Each has a target keyword, the current
  title, meta, URL, body and specs, the **facts** that must survive any rewrite verbatim, and a note on
  what's weak about the copy.
- `baseline.md`: scores of the original copy from the app's own engine (free to regenerate).
- `results/`: one report (`.md`) and spreadsheet (`.csv`) per real evaluation run.
- `run.eval.ts`: the runner. It uses exactly the app's prompts, output schemas, scoring and fact
  check (`src/lib/ai/rewrite.ts`, `src/lib/seo/facts.ts`), so results match what users get.

## Running it
```bash
npm run eval:baseline
```
Free: scores the original copy and rewrites `baseline.md`.

```bash
EVAL_CONFIRM=1 npm run eval
```
**Spends API credits** (the runner prints an upper estimate first and refuses without
`EVAL_CONFIRM=1`). Get a teammate's OK first. Needs `ANTHROPIC_API_KEY` in your shell, which lives only
in Vercel, so usually a teammate who holds the key runs it locally. Options:
- `EVAL_LIMIT=5`: first 5 cases only.
- `AI_MODEL=claude-haiku-5-5`: much cheaper trial run (about 1/40 of Opus); report results from
  the production model (Opus 5.5) when it matters.

Rough cost on Opus 5.5: about $0.02–$0.05 per rewrite, so about $1.20–$3 for all 30 cases × 2 rewrites.

## What a run reports
- **Average score change** for title, meta, description SEO and description GEO (best title/meta
  variant per case = facts kept first, then highest score).
- **Fact-preservation rate:** share of suggestions with no invented numbers, prices or claims (and, for
  descriptions, no dropped numbers or listed facts). The release bar: **no fact failures** in
  accepted rewrites.
- **Cost** in total and per rewrite.
- **Human rating:** fill the last column of the `.csv` (1–5) after reading the suggestions, then add
  the average to the report.
