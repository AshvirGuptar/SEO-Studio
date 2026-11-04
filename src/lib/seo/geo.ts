/**
 * GEO: Generative Engine Optimization. How likely AI answer engines (ChatGPT search, Perplexity,
 * Google AI Overviews / Gemini, Claude, Copilot) are to find, understand and cite a page.
 * Rule-based and deterministic: no AI calls. Grounded in what these systems document
 * (crawler user-agents, snippet controls) plus widely recommended content practices.
 */
import type { Check } from "./types";
import type { PageFacts } from "./extract";
import { agentAllowed } from "./robots";
import { words } from "./text";

export interface AiCrawler {
  token: string;
  owner: string;
  /** "search": fetches pages to answer/cite in AI search; "training": collects model training data. */
  kind: "search" | "training";
  product: string;
}

/** User-agent tokens published by each vendor. */
export const AI_CRAWLERS: AiCrawler[] = [
  { token: "OAI-SearchBot", owner: "OpenAI", kind: "search", product: "ChatGPT search" },
  { token: "ChatGPT-User", owner: "OpenAI", kind: "search", product: "ChatGPT browsing on request" },
  { token: "GPTBot", owner: "OpenAI", kind: "training", product: "OpenAI model training" },
  { token: "Claude-SearchBot", owner: "Anthropic", kind: "search", product: "Claude search" },
  { token: "Claude-User", owner: "Anthropic", kind: "search", product: "Claude browsing on request" },
  { token: "ClaudeBot", owner: "Anthropic", kind: "training", product: "Anthropic model training" },
  { token: "PerplexityBot", owner: "Perplexity", kind: "search", product: "Perplexity answers" },
  { token: "Perplexity-User", owner: "Perplexity", kind: "search", product: "Perplexity browsing on request" },
  { token: "Google-Extended", owner: "Google", kind: "training", product: "Gemini training & grounding" },
  { token: "Applebot-Extended", owner: "Apple", kind: "training", product: "Apple Intelligence training" },
  { token: "Amazonbot", owner: "Amazon", kind: "search", product: "Alexa / Rufus answers" },
  { token: "meta-externalagent", owner: "Meta", kind: "training", product: "Meta AI training" },
  { token: "CCBot", owner: "Common Crawl", kind: "training", product: "Open dataset used by many models" },
  { token: "Bytespider", owner: "ByteDance", kind: "training", product: "ByteDance model training" },
];

export interface CrawlerAccess extends AiCrawler {
  allowed: boolean;
}

export function crawlerAccess(robotsTxt: string, path = "/"): CrawlerAccess[] {
  return AI_CRAWLERS.map((c) => ({ ...c, allowed: agentAllowed(robotsTxt, c.token, path) }));
}

export interface GeoContext {
  /** robots.txt body; "" = none found (everything allowed); undefined = not checked. */
  robotsTxt?: string;
  /** null = not checked */
  llmsTxt?: boolean | null;
  /** Path of the analyzed page, for robots matching. */
  path?: string;
  keyword?: string;
  now?: Date;
}

const QUESTION = /^(who|what|when|where|why|how|which|can|does|do|is|are|should|will)\b|\?\s*$/i;
const LIMITS = { answerMin: 25, answerMax: 90, leadMin: 15, leadMax: 80, sectionMax: 350, longParagraph: 120, staleDays: 365 };

export function analyzeGeo(f: PageFacts, ctx: GeoContext = {}): { checks: Check[]; crawlers?: CrawlerAccess[] } {
  const g = f.geo;
  const checks: Check[] = [];
  const bodyWords = words(f.bodyText).length;

  // ---------- AI access ----------
  let crawlers: CrawlerAccess[] | undefined;
  if (ctx.robotsTxt !== undefined) {
    crawlers = crawlerAccess(ctx.robotsTxt, ctx.path ?? "/");
    const blockedSearch = crawlers.filter((c) => c.kind === "search" && !c.allowed);
    const blockedTraining = crawlers.filter((c) => c.kind === "training" && !c.allowed);
    checks.push({
      id: "geo-ai-search-crawlers", category: "ai-access", label: "AI search crawlers allowed", weight: 10,
      value: `${crawlers.filter((c) => c.kind === "search" && c.allowed).length}/${crawlers.filter((c) => c.kind === "search").length} allowed`,
      ...(blockedSearch.length === 0
        ? { severity: "pass", message: "robots.txt lets AI search engines (ChatGPT search, Perplexity, Claude…) fetch this page." }
        : { severity: "fail", message: `Blocked in robots.txt: ${blockedSearch.map((c) => c.token).join(", ")}. These engines can't read or cite this page.`,
            fix: "Remove the Disallow rules for AI search crawlers (you can still block training-only bots like GPTBot)." }),
    });
    checks.push({
      id: "geo-ai-training-crawlers", category: "ai-access", label: "AI training crawlers", weight: 1, severity: "info",
      value: `${blockedTraining.length} blocked`,
      message: blockedTraining.length
        ? `Training-only bots blocked: ${blockedTraining.map((c) => c.token).join(", ")}. A business choice; it doesn't stop AI search citations, but it can reduce how well models know your brand.`
        : "Training crawlers are allowed. Models may learn about your brand and content from this site.",
    });
  } else {
    checks.push({ id: "geo-ai-search-crawlers", category: "ai-access", label: "AI search crawlers allowed", weight: 1, severity: "info",
      message: "robots.txt wasn't checked (pasted HTML). Analyze the live URL to see which AI crawlers can access the page." });
  }

  const robots = (f.robots ?? "").toLowerCase();
  const snippetBlocked = /nosnippet|max-snippet\s*:\s*0\b/.test(robots) || /noindex/.test(robots);
  checks.push({
    id: "geo-snippet-controls", category: "ai-access", label: "Quotable by AI answers", weight: 8,
    ...(snippetBlocked
      ? { severity: "fail", message: `Robots meta "${f.robots}" stops search engines from quoting this page, which also removes it from Google's AI Overviews.`,
          fix: "Remove nosnippet / max-snippet:0 (and noindex) from pages you want cited." }
      : { severity: "pass", message: "No snippet restrictions; AI answers can quote this page." }),
  });

  checks.push({
    id: "geo-server-rendered", category: "ai-access", label: "Content in the HTML (no JavaScript needed)", weight: 8,
    value: `${bodyWords} words in HTML`,
    ...(g.appShellOnly
      ? { severity: "fail", message: "The HTML is an empty app shell. Most AI crawlers don't run JavaScript, so they see no content.",
          fix: "Server-render or pre-render the page so the text is in the initial HTML." }
      : bodyWords < 80
        ? { severity: "warn", message: "Very little text in the raw HTML. AI crawlers may not see your content if it loads with JavaScript.",
            fix: "Make sure key content is in the server-rendered HTML." }
        : { severity: "pass", message: "Content is present in the HTML that crawlers download." }),
  });

  if (ctx.llmsTxt !== undefined && ctx.llmsTxt !== null) {
    checks.push({
      id: "geo-llms-txt", category: "ai-access", label: "llms.txt", weight: 1, severity: ctx.llmsTxt ? "pass" : "info",
      message: ctx.llmsTxt
        ? "The site publishes /llms.txt, a curated map of its content for AI tools."
        : "No /llms.txt. It's an emerging, optional convention (a Markdown guide to your key pages for AI tools); major engines don't require it yet.",
    });
  }

  // ---------- Answer-ready content ----------
  const content = g.sections.filter((s) => s.level >= 2);
  const questions = content.filter((s) => QUESTION.test(s.heading));
  checks.push({
    id: "geo-question-headings", category: "answer-ready", label: "Question-style headings", weight: 4, value: `${questions.length} found`,
    ...(questions.length > 0
      ? { severity: "pass", message: "Headings phrased as questions match how people prompt AI assistants." }
      : { severity: "warn", message: "No headings phrased as questions.",
          fix: "Add H2/H3s that mirror real questions (“How do I choose…?”, “What size…?”) and answer each one directly below." }),
  });

  if (questions.length > 0) {
    const direct = questions.filter((q) => q.firstParagraphWords >= LIMITS.answerMin && q.firstParagraphWords <= LIMITS.answerMax);
    checks.push({
      id: "geo-direct-answers", category: "answer-ready", label: "Direct answers under questions", weight: 6,
      value: `${direct.length}/${questions.length}`,
      ...(direct.length / questions.length >= 0.6
        ? { severity: "pass", message: "Questions are followed by concise answers that AI engines can lift as-is." }
        : { severity: "warn", message: "Many questions aren't followed by a short, self-contained answer.",
            fix: `Start each answer with a ${LIMITS.answerMin}–${LIMITS.answerMax} word paragraph that fully answers the question, then add detail.` }),
    });
  }

  checks.push({
    id: "geo-summary-lead", category: "answer-ready", label: "Answer-first opening", weight: 5, value: `${g.firstParagraphWords} words`,
    ...(g.firstParagraphWords >= LIMITS.leadMin && g.firstParagraphWords <= LIMITS.leadMax
      ? { severity: "pass", message: "The opening paragraph is a concise summary, which is ideal for AI overviews." }
      : { severity: "warn", message: g.firstParagraphWords === 0 ? "No opening paragraph found." : "The opening paragraph is too long (or too short) to work as a summary.",
          fix: `Open with a ${LIMITS.leadMin}–${LIMITS.leadMax} word paragraph that states what the page is about and the key takeaway.` }),
  });

  checks.push({
    id: "geo-lists-tables", category: "answer-ready", label: "Lists & tables", weight: 3, value: `${g.lists} lists · ${g.tables} tables`,
    ...(g.lists + g.tables > 0
      ? { severity: "pass", message: "Structured lists/tables are easy for AI to extract (specs, steps, comparisons)." }
      : { severity: "warn", message: "No lists or tables.", fix: "Put steps, specs, pros/cons or comparisons in lists or tables." }),
  });

  if (content.length > 0) {
    const longSections = content.filter((s) => s.words > LIMITS.sectionMax).length;
    checks.push({
      id: "geo-chunking", category: "answer-ready", label: "Scannable sections", weight: 3, value: `${longSections} long sections`,
      ...(longSections === 0
        ? { severity: "pass", message: "Sections are short and focused, so each can stand alone as an answer." }
        : { severity: "warn", message: `${longSections} section(s) run over ${LIMITS.sectionMax} words without a subheading.`,
            fix: "Break long sections up with descriptive subheadings; AI engines retrieve passages, not whole pages." }),
    });
  }

  if (g.paragraphWordCounts.length > 0) {
    const long = g.paragraphWordCounts.filter((n) => n > LIMITS.longParagraph).length;
    checks.push({
      id: "geo-paragraphs", category: "answer-ready", label: "Paragraph length", weight: 2, value: `${long} over ${LIMITS.longParagraph} words`,
      ...(long === 0
        ? { severity: "pass", message: "Paragraphs are compact." }
        : { severity: "warn", message: "Some paragraphs are very long.", fix: "Keep paragraphs to one idea, 2–4 sentences." }),
    });
  }

  // ---------- Trust & citability ----------
  checks.push({
    id: "geo-author", category: "trust", label: "Author / source shown", weight: 4, value: g.author,
    ...(g.author
      ? { severity: "pass", message: "The page names an author or source, a credibility signal for AI engines." }
      : { severity: "warn", message: "No author or byline found.", fix: "Add a visible byline and author in Article/Person schema (or Organization for product pages)." }),
  });

  const dateStr = g.dateModified ?? g.datePublished;
  const date = dateStr ? new Date(dateStr) : null;
  const ageDays = date && !Number.isNaN(+date) ? ((ctx.now ?? new Date()).getTime() - date.getTime()) / 86_400_000 : null;
  checks.push({
    id: "geo-freshness", category: "trust", label: "Dates & freshness", weight: 4, value: date && ageDays !== null ? date.toISOString().slice(0, 10) : undefined,
    ...(ageDays === null
      ? { severity: "warn", message: "No published or updated date found.", fix: "Expose datePublished/dateModified in schema and show “Updated <date>” on the page." }
      : ageDays > LIMITS.staleDays
        ? { severity: "warn", message: `Last updated over a year ago (${Math.round(ageDays / 30)} months).`, fix: "Refresh the content and update dateModified; AI engines favor current information." }
        : { severity: "pass", message: "Dated and recently updated." }),
  });

  const externals = f.links.filter((l) => !l.internal).length;
  checks.push({
    id: "geo-citations", category: "trust", label: "Cites sources", weight: 3, value: `${externals} outbound links`,
    ...(externals >= 2 || bodyWords < 300
      ? { severity: externals >= 2 ? "pass" : "info", message: externals >= 2 ? "Links out to sources, which supports credibility." : "Short page; outbound citations are optional here." }
      : { severity: "warn", message: "No sources cited.", fix: "Link to authoritative sources (standards, studies, manufacturers) for claims and statistics." }),
  });

  const stats = (f.bodyText.match(/\b\d[\d,.]*\s?(%|percent|x\b|mm|cm|kg|lbs?|oz|hours?|days?|years?|miles?|km|\$)|\$\s?\d/gi) ?? []).length;
  checks.push({
    id: "geo-specifics", category: "trust", label: "Concrete facts & numbers", weight: 3, value: `${stats} found`,
    ...(stats >= 3
      ? { severity: "pass", message: "Specific figures (sizes, prices, percentages, durations) make content quotable." }
      : { severity: "warn", message: "Few concrete numbers.", fix: "Add specifics: measurements, prices, test results, percentages, timeframes." }),
  });

  // ---------- Entity & structured data ----------
  const types = f.jsonLdTypes;
  const contentTypes = ["Article", "BlogPosting", "NewsArticle", "Product", "FAQPage", "HowTo", "Recipe", "Review", "Service", "LocalBusiness", "Course", "Event"];
  checks.push({
    id: "geo-schema", category: "entity", label: "Content schema", weight: 5, value: types.join(", ") || undefined,
    ...(types.some((t) => contentTypes.includes(t))
      ? { severity: "pass", message: "Schema tells AI engines exactly what this page is (product, article, FAQ…)." }
      : { severity: "warn", message: "No content-type schema (Product, Article, FAQPage, HowTo…).", fix: "Add JSON-LD for the page's main entity." }),
  });

  if (questions.length >= 2) {
    checks.push({
      id: "geo-faq-schema", category: "entity", label: "FAQ markup", weight: 2,
      ...(g.faqQuestions > 0
        ? { severity: "pass", message: `FAQPage schema with ${g.faqQuestions} question(s).` }
        : { severity: "info", message: "The page has Q&A-style sections. FAQPage schema makes them explicit to machines." }),
    });
  }

  checks.push({
    id: "geo-entity", category: "entity", label: "Brand entity (sameAs)", weight: 3, value: g.sameAsCount ? `${g.sameAsCount} profiles` : undefined,
    ...(g.sameAsCount > 0
      ? { severity: "pass", message: "Organization/Person schema links to official profiles, helping AI connect the page to your brand." }
      : { severity: "warn", message: "No Organization/Person schema with sameAs links.",
          fix: "Add Organization schema with sameAs links (LinkedIn, Wikipedia/Wikidata, social profiles) — typically site-wide." }),
  });

  return { checks, crawlers };
}
