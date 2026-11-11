# SEO & GEO Studio — Project Plan (Weeks 2–5)

**What we're building:** an internal, deployed platform that helps a team and its clients rank in
search engines (**SEO**) and get found, quoted and cited by AI answer engines like ChatGPT search,
Perplexity, Google AI Overviews and Claude (**GEO**). It's meant as a focused, in-house alternative
to tools like Semrush: page audits, site crawls, content/URL/keyword tools, AI-assisted fixes, AI
visibility tracking, and saved history per client.

**Live app:** https://seo-studio-weld.vercel.app/ · **Repo:** AshvirGuptar/SEO-Studio ·
**Course:** TCSS 490 Artifact 5 (moonshot) · **Final show & tell:** Monday, **Dec 7, 2026**

Status keys: `[x]` done · `[~]` in progress · `[ ]` not started. Tick items as they land and add a
row to the Development log at the bottom of `CLAUDE.md` at the end of every session.

---

## Calendar

| Project week | Dates | Course week | Theme | Monday checkpoint |
| --- | --- | --- | --- | --- |
| Week 1 (now) | Nov 4 – Nov 15 | 6 | Scaffold + rule-based tools (done, see below) | Nov 9 office hours |
| **Week 2** | Nov 16 – 22 | 7 | Accounts, data & the AI foundation | Nov 16 office hours |
| **Week 3** | Nov 23 – 29 | 8 | AI-powered tools: GEO Optimization + AI rewrite | Nov 23 office hours |
| **Week 4** | Nov 30 – Dec 6 | 9 | AI Visibility, client pilot, card-based dashboard, guided demo | Nov 30 office hours |
| **Week 5** | Dec 7 – 13 | 10 | **Show & tell (Dec 7)**, launch v1.0, handoff, portfolio | Dec 7 final show |

Week 3 includes Thanksgiving (Thu Nov 26), so it's planned at about 60% capacity.

---

## Where we are at the end of Week 1

Week 1 delivered the scaffolding the assignment asks for, plus every tool that works **without** an
AI API or user accounts:

- [x] **Scaffold:** Next.js 16 + TypeScript + Tailwind; `CLAUDE.md` (agent guide and conventions),
      this plan, a development log; GitHub Actions CI (tests, lint, build) on every push;
      deployed to Vercel from `main`, with a preview deployment for every PR.
- [x] **Pure, tested analysis engine** (`src/lib/seo/`): one shared `Check` contract and weighted
      scoring, 96 unit tests.
- [x] **Live tools:** Page Analyzer (SEO + GEO score, AI-crawler access, PDF report), Content
      Optimizer (title/meta/URL/body/specs, SEO + GEO score), URL Optimizer (bulk + redirect map),
      Site Audit (500-page crawl, 17 site-wide issue types, AI visibility card, PDF), Keyword Clusters
      (intent, page mapping, gaps, cannibalization), Guide.
- [x] **Accounts and saved data, code complete but not switched on:** Neon Postgres + Drizzle
      migrations, Google sign-in (Better Auth), invite-only access with admin/member roles, Projects
      & History (charts, "what changed" between audits). It's off until Google OAuth keys are set in
      Vercel.
- [x] **Quality:** phone/tablet pass (0px overflow on 40 page/device combinations), SSRF-safe
      fetching, demo mode (`PUBLIC_TOOLS`), signed-in end-to-end test script.
- [x] **Placeholders for the next features:** GEO Optimization and AI Visibility appear as
      "coming soon" tools.

**What's missing for a real launch:** accounts aren't live yet, nothing uses AI yet, we have no proof
that following the tool improves real pages, no real users have tried it, and the UI is organized
around individual tools rather than around a client's work. Weeks 2–5 close those gaps, in
dependency order.

---

## Week 2 (Nov 16–22): Accounts, data & the AI foundation

**Goal:** turn on real logins and saved data in production, and build a safe, measured foundation
for every AI feature that follows.

**Why this takes a full week**
- Production sign-in involves outside systems, each with its own setup: a Google Cloud OAuth
  client with a published consent screen, environment variables in Vercel, running the first
  migration against the real Neon database, and verifying the admin/invite/approval flows with real
  Google accounts. None of this can be tested from the dev sandbox, so it needs careful manual
  checks.
- Opening sign-in to outside users makes the app a target, so the API needs rate limiting and abuse
  controls *before* we attach a paid AI key. An open AI endpoint spends real money.
- AI output quality has to be **measured**, not eyeballed. Building the evaluation set (realistic
  pages and products with expected outcomes) is slow, careful work, and Week 3 depends on it.

**Deliverables**
- [ ] **Sign-in live in production:** Google OAuth client; `BETTER_AUTH_SECRET`, `GOOGLE_*` and
      `ADMIN_EMAILS` set in Vercel; first migration applied to Neon; sign-in, invite, approve and
      disable verified with real accounts.
- [ ] **Projects & History in real use:** save page and site audits; check the history chart and
      "what changed" on real data; add pagination for long histories; rename and delete projects.
- [ ] **Per-project access:** a read-only **client** role so outside users only see their own
      project. Required before the client pilot in Week 4.
- [ ] **Abuse controls:** per-user and per-IP rate limits on the tool APIs; request size caps;
      an audit log of admin actions.
- [ ] **Claude API foundation** (`src/lib/ai/`, server-only):
  - [ ] Anthropic TypeScript SDK; `ANTHROPIC_API_KEY` stored only in Vercel. The default model is
        Claude Opus 5.5 (`claude-opus-5-5`, $4 / $20 per million input/output tokens).
  - [ ] Streaming responses for long outputs; handling for refusals, rate limits and timeouts;
        prompt caching for the shared instructions.
  - [ ] **Cost guardrails:** an `ai_usage` table logging tokens per user and project, a daily
        per-user cap, and a monthly budget alert.
  - [ ] Graceful degradation: with no key set, AI buttons stay visible but disabled (CLAUDE.md rule).
- [ ] **Evaluation set v1:** 30 realistic pages and products (product, category, blog, plus the
      "Example PC" store). For each one we record the SEO/GEO score before and after a rewrite,
      whether all facts and specs were preserved, and a human quality rating.
- [ ] **Tool platform for future tools:** turn the tool list into a registry. Each tool declares
      its name, status, tags, sign-in/AI requirements, preview and use cases, so a new tool is one
      folder plus one registry entry. This is the "space for more tools".

**Monday Nov 16 checkpoint:** live sign-in demo; the AI module returns a scored rewrite on one
evaluation page.
**Done when:** a teammate can sign in on the live site, save an audit and see its history; one Claude
call works end-to-end within the cost limits; the evaluation set is committed.

---

## Week 3 (Nov 23–29, Thanksgiving week): AI-powered tools

**Goal:** ship the two features that turn "here's what's wrong" into "here's the fix": **GEO
Optimization** and **AI rewrite**. Every AI suggestion is re-scored by our own engine before a
human accepts it.

**Why this takes a week, even at reduced capacity**
- Prompt work is iterative: write the prompt, run the evaluation set, read the failures, adjust,
  repeat. Each round costs time and API money, so we budget rounds instead of guessing.
- The hardest problem is **trust**: rewrites must never invent specs, prices or claims. We need an
  automatic fact-preservation check (every spec value and number in the source must survive
  unchanged) and human review of edge cases.
- Generated markup (FAQ, Product, Organization JSON-LD) must be valid. We validate it against
  schema.org shapes and re-run our own analyzer on the result.

**Deliverables**
- [ ] **GEO Optimization tool** (the locked tab becomes live):
  - [ ] **Answer-first rewrite:** adds a summary lead, question headings and short direct answers.
        It shows the GEO score before and after, with a side-by-side diff to accept or reject.
  - [ ] **FAQ generator:** writes questions and answers from the page's own content and outputs
        FAQPage JSON-LD.
  - [ ] **Schema builder:** Product, Organization (with `sameAs`) and Article JSON-LD, validated
        before export.
  - [ ] **AI access kit:** an AI-crawler `robots.txt` rules builder (search bots vs training bots)
        and an `llms.txt` generator from a site audit.
- [ ] **AI rewrite in the Content Optimizer:** 3–5 title and meta variants, a product description
      rewrite that keeps every spec, a tone setting, and each variant scored live.
- [ ] **Evaluation run:** publish the results in `docs/eval/`: average score gain, fact-preservation
      rate, human ratings, and cost per rewrite. Our estimate is about $0.03–$0.06 per rewrite
      (about 3k input and 1.5k output tokens) before caching.
- [ ] **Pilot preparation:** recruit 2–3 pilot users (internal team members and/or friendly client
      sites). Run baseline Site Audits and save them to projects, so we have "before" data to
      compare against in Weeks 4–5.

**Monday Nov 23 checkpoint:** GEO Optimization rewriting an evaluation page live, with the score
change and fact check shown.
**Done when:** on the evaluation set, accepted rewrites raise the GEO score on most pages without a
single fact-preservation failure; pilot baselines are saved.

---

## Week 4 (Nov 30 – Dec 6): AI Visibility, client pilot, dashboard & demo

**Goal:** prove the tool works on real sites, measure what AI assistants actually say about a
brand, and reorganize the UI around a client's work. The app should be demo-ready by Sunday Dec 6.

**Why this takes a week**
- **AI Visibility** is a new kind of measurement. We ask AI assistants the questions customers ask,
  using Claude with the web search tool (`web_search_20260209`) to see which sites get cited, and
  record mentions and citations over time. Designing fair prompt sets, parsing citations reliably,
  and scheduling repeat runs within budget all need careful design and testing.
- **Real users take calendar time:** scheduling sessions, watching people use the tool, collecting
  feedback, and fixing what confuses them. Their pages also need to be re-audited after they apply
  fixes.
- **The UI restructure touches every page:** moving from a tool-first layout to a client-first,
  card-based dashboard means redesigning navigation, empty states and mobile layouts, then
  rerunning the device sweep.

**Deliverables**
- [ ] **AI Visibility v1** (the locked tab becomes live):
  - [ ] A prompt set per project (for example "best graphics card for 1440p"), with tracked brands
        and competitors.
  - [ ] Runs record whether the brand is mentioned, whether its domain is cited, and the source
        links, stored per project.
  - [ ] Share-of-voice vs competitors and a trend over time.
  - [ ] Cost estimate shown before each run (roughly $0.05–$0.10 per prompt including web search,
        so about 25 prompts per project per week).
  - [ ] Other engines (ChatGPT, Perplexity, Gemini) are listed as "add a key to enable" (stretch).
- [ ] **Client pilot:**
  - [ ] Pilot users apply recommendations on real pages.
  - [ ] Re-audits show the before/after change with the "what changed" view.
  - [ ] An in-app feedback button plus short interviews.
  - [ ] A prioritized fix list, with the top items fixed this week.
- [ ] **Card-based dashboard:**
  - [ ] Home becomes a workspace: project cards with SEO/GEO/AI-visibility tiles, recent audits,
        and the next recommended action.
  - [ ] Tools open from cards in a project context.
  - [ ] Device sweep and accessibility pass afterwards.
- [ ] **Guide + guided demo:**
  - [ ] An interactive walkthrough on a sample project (the "Example PC" store): audit → fix with
        GEO Optimization → re-score → visibility check.
  - [ ] A "How we measure" page explaining each check and the guidance behind it, so users can see
        *why* a fix should help.
  - [ ] A case study with anonymized pilot before/after results.
- [ ] **Short demo video** for the portfolio card (a backup if the live demo misbehaves).

**Monday Nov 30 checkpoint:** AI Visibility on a pilot brand; first pilot feedback; dashboard mockup.
**Done when:** at least two pilot sites show measurable on-page score improvements; AI Visibility runs
on a schedule within budget; the dashboard and demo walkthrough are live.

---

## Week 5 (Dec 7–13): Show & tell, launch v1.0, handoff

**Goal:** present what we built and learned, then fold in the feedback and leave a maintainable,
documented v1.0.

**Why this is still a full week**
- The final show (Mon Dec 7) will produce feedback worth acting on.
- Pilot re-measurements continue. AI citations and search signals take weeks to move, so the
  latest data improves the case study.
- A handoff that others (teammates, clients, future agents) can pick up needs real documentation,
  not just working code.

**Deliverables**
- [ ] **Dec 7 show & tell:** a live demo (with demo mode or a prepared account, plus the video as
      backup); what worked, what didn't, and what we learned building with AI agents.
- [ ] **v1.0 release:** fixes from show feedback, a final security review (auth guards, rate
      limits, secrets), production smoke test, and a tagged release.
- [ ] **Handoff docs:** README (setup, sign-in, adding a tool via the registry), an admin guide
      (invites, roles, AI budget), refreshed CLAUDE.md, and a final Development log row with a retrospective.
- [ ] **Portfolio card + Canvas:** title, link (live site + repo), a short reflection; each
      teammate submits their own.
- [ ] **Roadmap for after the course:** the backlog below, ranked by pilot feedback.

**Done when:** v1.0 is live and tagged, the docs let a new teammate get set up without help, and the
portfolio is submitted.

---

## Effort budget and why five weeks are needed

| Workstream | Weeks | Est. hours | Why it can't be rushed |
| --- | --- | --- | --- |
| Production sign-in, client role, abuse controls | 2 | 14–18 | External setup (Google, Vercel, Neon) plus manual verification with real accounts |
| Claude API foundation + cost guardrails | 2 | 10–14 | Streaming, refusals, rate limits and budgets must be right before spending money |
| Evaluation set + evaluation runs | 2–3 | 12–16 | Realistic data and human review; every prompt change is measured against it |
| GEO Optimization (rewrite, FAQ, schema, AI access kit) | 3 | 18–24 | Iterative prompting, fact preservation, valid markup |
| AI rewrite in Content Optimizer | 3 | 8–10 | Reuses the foundation; needs spec preservation and scoring |
| AI Visibility tracker | 4 | 18–22 | New measurement design, citation parsing, scheduling, budget |
| Client pilot + feedback fixes | 3–5 | 16–20 | Real people's schedules; re-audits after changes |
| Card-based dashboard + mobile/accessibility | 4 | 12–16 | Touches every page; full device sweep afterwards |
| Guide, guided demo, "How we measure", case study, video | 4–5 | 10–14 | Has to explain and *prove* the value to non-experts |
| Tool registry ("space for more tools") | 2 | 4–6 | Makes every future tool cheap to add |
| Launch, security review, docs, show prep, portfolio | 5 | 10–12 | The polish that makes it hand-off-able |
| **Total** | | **≈ 130–170 h** | About 26–34 h/week for 2 people, or a full load solo |

**Dependencies:** sign-in and the client role (Week 2) come before the client pilot (Week 4). The AI
foundation and evaluation set (Week 2) come before GEO Optimization and AI rewrite (Week 3), which
come before the pilot fixes. Pilot baselines (Week 3) come before before/after proof (Weeks 4–5),
which comes before the case study and show. Skipping a week breaks the chain, which is why the
order matters.

**Team split (if two people):**
- **Person A:** platform, meaning sign-in, client role, abuse controls, AI Visibility data and
  scheduling, dashboard.
- **Person B:** AI and content, meaning the AI module, evaluation set, GEO Optimization, AI rewrite,
  guide and demo.
- **Shared:** pilot sessions and show prep.

Each works on their own branch, merges through PRs with CI, and adds a Development log row (bottom of CLAUDE.md) per session.

---

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| AI rewrites invent facts or specs | Automatic fact-preservation check, human accept/reject, evaluation-set gate before release |
| API costs run away | Per-user daily caps, usage logging, budget alerts, prompt caching, cost estimate before AI Visibility runs |
| Pilot users are slow or unavailable | Recruit early (Week 3), keep the internal team as a fallback pilot, use the "Example PC" demo store |
| SEO/AI results lag behind changes | Measure on-page score changes immediately; treat citation and ranking changes as longer-term evidence and say so honestly |
| Google OAuth or Vercel setup blocks sign-in | Code already works locally and in tests; demo mode keeps tools usable; time is set aside in Week 2 |
| Live demo fails on Dec 7 | Recorded demo video, demo mode, prepared demo account |
| Scope creep | Backlog below; anything not in Weeks 2–5 waits until after v1.0 |

---

## Backlog: more tools after v1.0

These plug into the Week 2 tool registry; ordering will follow pilot feedback.

- [ ] Google Search Console + GA4 integration (real clicks, impressions, rankings)
- [ ] Core Web Vitals via the PageSpeed Insights API
- [ ] Internal-link suggestions and competitor page comparison
- [ ] Scheduled re-audits with emailed "what changed" summaries
- [ ] Bulk AI rewrites from a product CSV, with brand voice settings per project
- [ ] Semantic keyword clustering with embeddings
- [ ] Rank tracking (needs a paid search-results data API)
- [ ] Shopify / CMS catalog import; a Chrome extension to "analyze this page"

---

## Decisions log

- **Hosting:** Vercel (deploys from `main`, PR previews). **Database:** Neon Postgres via Drizzle.
  **Sign-in:** Better Auth + Google, invite-only, so outside users are supported.
- **AI provider:** Claude through the Anthropic SDK, server-side only; default model Claude Opus 5.5.
  Every AI output is re-scored by our deterministic engine.
- **GEO split:** the Page Analyzer and Site Audit *diagnose*, GEO Optimization *fixes*, and AI
  Visibility *measures* results.
- **Rule-based first:** everything that can work without AI does, so the product is useful even
  with no API key or budget.
