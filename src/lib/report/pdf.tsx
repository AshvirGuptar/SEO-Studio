/**
 * Downloadable PDF reports, rendered in the browser with @react-pdf/renderer.
 * Only imported on demand (when someone clicks "Download PDF report").
 * Light, print-friendly layout; brand orange used as an accent only. Status is always written
 * as text ("FAIL", "WARN"), never color alone.
 */
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { Report } from "@/app/(app)/analyzer/AnalyzerClient";
import type { Check, ScoreSummary } from "@/lib/seo/types";
import type { CrawledPage, SiteAuditResult, SiteIssue } from "@/lib/seo/site-audit";
import type { CrawlerAccess } from "@/lib/seo/geo";
import { BRAND } from "@/lib/brand";

const C = {
  ink: "#111114", muted: "#5b5b66", subtle: "#8a8a96", line: "#e5e5ea", soft: "#f6f6f8",
  accent: "#F15A29", pass: "#0f9f6e", warn: "#b98900", fail: "#d6304f", info: "#2f6fd6",
};

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontSize: 9.5, color: C.ink, fontFamily: "Helvetica", lineHeight: 1.4 },
  band: { height: 4, backgroundColor: C.accent, marginHorizontal: -40, marginTop: -36, marginBottom: 24 },
  brand: { fontSize: 9, color: C.muted, letterSpacing: 0.5 },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 4, lineHeight: 1.25 },
  meta: { fontSize: 9, color: C.muted, marginTop: 6 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 8 },
  h3: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 4 },
  row: { flexDirection: "row" },
  box: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 12, marginRight: 10 },
  boxLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  big: { fontSize: 26, fontFamily: "Helvetica-Bold", lineHeight: 1.15, marginTop: 4 },
  small: { fontSize: 8.5, color: C.muted },
  check: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.line },
  tag: { width: 34, fontSize: 7, fontFamily: "Helvetica-Bold", paddingTop: 1 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.subtle },
  td: { paddingVertical: 4, paddingRight: 6, borderBottomWidth: 1, borderBottomColor: C.line },
});

/** The built-in PDF fonts only cover Latin-1-ish characters; swap the few symbols we use. */
const t = (str: string | undefined) => (str ?? "").replace(/→/g, "->").replace(/[✓✔]/g, "OK").replace(/[✕✗]/g, "x").replace(/[▲]/g, "+").replace(/[▼]/g, "-").replace(/≤/g, "<=").replace(/≥/g, ">=");

const scoreColor = (n: number) => (n >= 80 ? C.pass : n >= 60 ? C.warn : C.fail);
const TAG: Record<Check["severity"], { t: string; c: string }> = {
  fail: { t: "FAIL", c: C.fail }, warn: { t: "WARN", c: C.warn }, pass: { t: "PASS", c: C.pass }, info: { t: "INFO", c: C.info },
};
const today = () => new Date().toLocaleDateString(undefined, { dateStyle: "long" });

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>{BRAND.name} · generated {today()}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function ScoreBox({ label, summary, note }: { label: string; summary: ScoreSummary; note: string }) {
  return (
    <View style={s.box}>
      <Text style={s.boxLabel}>{label}</Text>
      <View style={[s.row, { alignItems: "flex-end", marginBottom: 4 }]}>
        <Text style={[s.big, { color: scoreColor(summary.score) }]}>{summary.score}</Text>
        <Text style={{ fontSize: 11, color: C.muted, marginLeft: 4, marginBottom: 4 }}>/ 100 · grade {summary.grade}</Text>
      </View>
      <Text style={s.small}>{summary.counts.fail} failed · {summary.counts.warn} warnings · {summary.counts.pass} passed</Text>
      <Text style={[s.small, { marginTop: 4 }]}>{note}</Text>
    </View>
  );
}

function CheckRows({ checks }: { checks: Check[] }) {
  const order: Check["severity"][] = ["fail", "warn", "info", "pass"];
  const sorted = [...checks].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || b.weight - a.weight);
  return (
    <View>
      {sorted.map((c) => (
        <View key={c.id} style={s.check} wrap={false}>
          <Text style={[s.tag, { color: TAG[c.severity].c }]}>{TAG[c.severity].t}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(c.label)}{c.value ? <Text style={{ fontFamily: "Helvetica", color: C.muted }}>  ·  {t(c.value)}</Text> : null}</Text>
            <Text style={{ color: C.muted }}>{t(c.message)}</Text>
            {c.fix && c.severity !== "pass" ? <Text><Text style={{ color: C.accent, fontFamily: "Helvetica-Bold" }}>Fix: </Text>{t(c.fix)}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function Priorities({ checks, max = 6 }: { checks: Check[]; max?: number }) {
  const top = checks
    .filter((c) => c.severity === "fail" || c.severity === "warn")
    .sort((a, b) => (a.severity === b.severity ? b.weight - a.weight : a.severity === "fail" ? -1 : 1))
    .slice(0, max);
  if (!top.length) return <Text style={s.small}>No issues. Nothing urgent to fix.</Text>;
  return (
    <View>
      {top.map((c, i) => (
        <View key={c.id} style={[s.row, { marginBottom: 4 }]} wrap={false}>
          <Text style={{ width: 16, color: C.accent, fontFamily: "Helvetica-Bold" }}>{i + 1}.</Text>
          <Text style={{ flex: 1 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>{t(c.label)}: </Text>{t(c.fix ?? c.message)}</Text>
        </View>
      ))}
    </View>
  );
}

function Crawlers({ crawlers }: { crawlers: CrawlerAccess[] }) {
  return (
    <View>
      {crawlers.map((c) => (
        <View key={c.token} style={[s.row, s.td]} wrap={false}>
          <Text style={{ width: 110, fontFamily: "Helvetica-Bold" }}>{c.token}</Text>
          <Text style={{ flex: 1, color: C.muted }}>{c.owner} · {c.product} ({c.kind === "search" ? "AI search" : "training"})</Text>
          <Text style={{ width: 50, textAlign: "right", fontFamily: "Helvetica-Bold", color: c.allowed ? C.pass : C.fail }}>{c.allowed ? "Allowed" : "Blocked"}</Text>
        </View>
      ))}
    </View>
  );
}

function PageReportDoc({ report }: { report: Report }) {
  const f = report.facts;
  return (
    <Document title={`SEO & GEO report: ${report.url ?? "page"}`} author={BRAND.name} creator={BRAND.name}>
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />
        <Text style={s.brand}>{BRAND.name.toUpperCase()} · PAGE REPORT</Text>
        <Text style={s.h1}>{t(f.title) || "Untitled page"}</Text>
        <Text style={s.meta}>{report.url ?? "Pasted HTML"}{report.keyword ? `  ·  Target keyword: "${report.keyword}"` : ""}  ·  Analyzed {new Date(report.analyzedAt).toLocaleString()}</Text>

        <View style={[s.row, { marginTop: 18 }]}>
          <ScoreBox label="SEO score" summary={report.summary} note="On-page optimization for search engines." />
          {report.geo ? <ScoreBox label="GEO score" summary={report.geo.summary} note="Readiness to be found and cited by AI answer engines." /> : <View style={s.box}><Text style={s.small}>GEO not available for this report.</Text></View>}
        </View>

        <Text style={s.h2}>Top priorities</Text>
        <Text style={s.h3}>Search (SEO)</Text>
        <Priorities checks={report.checks} />
        {report.geo && <><Text style={s.h3}>AI answers (GEO)</Text><Priorities checks={report.geo.checks} /></>}

        <Text style={s.h2}>Page at a glance</Text>
        <View style={s.row}>
          {[
            ["Words", f.wordCount], ["Headings", f.headings.length], ["Images", f.images.length],
            ["Internal links", f.links.filter((l) => l.internal).length], ["External links", f.links.filter((l) => !l.internal).length],
          ].map(([k, v]) => (
            <View key={String(k)} style={[s.box, { padding: 8 }]}><Text style={s.boxLabel}>{k}</Text><Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold" }}>{String(v)}</Text></View>
          ))}
        </View>
        <Text style={[s.small, { marginTop: 6 }]}>Meta description: {f.metaDescription || "(none)"}</Text>
        <Text style={s.small}>Structured data: {f.jsonLdTypes.join(", ") || "(none)"}</Text>

        <Text style={s.h2} break>All SEO checks</Text>
        <CheckRows checks={report.checks} />

        {report.geo && (
          <>
            <Text style={s.h2} break>All GEO checks</Text>
            <Text style={[s.small, { marginBottom: 6 }]}>GEO (generative engine optimization) measures how easily AI answer engines such as ChatGPT search, Perplexity, Google AI Overviews and Claude can access, understand and cite this page.</Text>
            <CheckRows checks={report.geo.checks} />
            {report.geo.crawlers && <><Text style={s.h3}>AI crawler access (robots.txt)</Text><Crawlers crawlers={report.geo.crawlers} /></>}
          </>
        )}
        <Footer />
      </Page>
    </Document>
  );
}

export interface SiteReportData {
  startUrl: string;
  audit: SiteAuditResult & { issues: (SiteIssue & { total?: number })[] };
  pages: CrawledPage[];
  sitemapUrlCount: number;
  robotsFound?: boolean;
  aiCrawlers?: CrawlerAccess[];
  llmsTxt?: boolean | null;
}

function SiteReportDoc({ d }: { d: SiteReportData }) {
  const a = d.audit;
  const count = (i: SiteIssue & { total?: number }) => i.total ?? i.items.length;
  const SEV: Record<SiteIssue["severity"], { t: string; c: string }> = { fail: TAG.fail, warn: TAG.warn, info: TAG.info };
  const worst = [...d.pages].filter((p) => p.score !== undefined).sort((x, y) => (x.score ?? 0) - (y.score ?? 0)).slice(0, 40);
  const geoScores = d.pages.map((p) => p.geoScore).filter((n): n is number => typeof n === "number");
  const avgGeo = geoScores.length ? Math.round(geoScores.reduce((x, y) => x + y, 0) / geoScores.length) : null;
  return (
    <Document title={`Site audit: ${d.startUrl}`} author={BRAND.name} creator={BRAND.name}>
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />
        <Text style={s.brand}>{BRAND.name.toUpperCase()} · SITE AUDIT</Text>
        <Text style={s.h1}>{d.startUrl}</Text>
        <Text style={s.meta}>{a.pages} pages crawled · {a.okPages} OK · sitemap: {d.sitemapUrlCount ? `${d.sitemapUrlCount} URLs` : "not found"} · robots.txt: {d.robotsFound ? "found" : "not found"}</Text>

        <View style={[s.row, { marginTop: 18 }]}>
          <View style={s.box}><Text style={s.boxLabel}>Site health</Text><Text style={[s.big, { color: scoreColor(a.healthScore), marginBottom: 4 }]}>{a.healthScore}</Text><Text style={s.small}>Share of clean pages blended with page scores</Text></View>
          <View style={s.box}><Text style={s.boxLabel}>Avg. SEO score</Text><Text style={[s.big, { color: scoreColor(a.avgPageScore), marginBottom: 4 }]}>{a.avgPageScore}</Text><Text style={s.small}>Across pages that loaded</Text></View>
          <View style={s.box}><Text style={s.boxLabel}>Avg. GEO score</Text><Text style={[s.big, { color: avgGeo === null ? C.subtle : scoreColor(avgGeo), marginBottom: 4 }]}>{avgGeo ?? "–"}</Text><Text style={s.small}>AI answer-engine readiness</Text></View>
        </View>

        <Text style={s.h2}>Issues</Text>
        {a.issues.length === 0 ? <Text style={s.small}>No issues found.</Text> : a.issues.map((i) => (
          <View key={i.id} style={{ marginBottom: 8 }} wrap={false}>
            <View style={s.row}>
              <Text style={[s.tag, { color: SEV[i.severity].c }]}>{SEV[i.severity].t}</Text>
              <Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>{i.label}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{count(i)}</Text>
            </View>
            <Text style={[s.small, { marginLeft: 34 }]}>{t(i.description)} <Text style={{ color: C.accent }}>Fix: </Text>{t(i.fix)}</Text>
            {i.items.slice(0, 5).map((x, k) => (
              <Text key={k} style={[s.small, { marginLeft: 34, color: C.subtle }]}>• {x.url}{x.detail ? `  ${t(x.detail)}` : ""}</Text>
            ))}
            {count(i) > 5 && <Text style={[s.small, { marginLeft: 34, color: C.subtle }]}>…and {count(i) - 5} more</Text>}
          </View>
        ))}

        {d.aiCrawlers && (
          <>
            <Text style={s.h2}>AI crawler access</Text>
            <Text style={[s.small, { marginBottom: 6 }]}>From robots.txt. AI search crawlers must be allowed for the site to be read and cited in AI answers. llms.txt: {d.llmsTxt ? "present" : d.llmsTxt === false ? "not found" : "not checked"}.</Text>
            <Crawlers crawlers={d.aiCrawlers} />
          </>
        )}

        <Text style={s.h2} break>Lowest-scoring pages</Text>
        <View style={[s.row, { borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 3 }]}>
          <Text style={{ width: 40, fontFamily: "Helvetica-Bold" }}>Status</Text>
          <Text style={{ width: 34, fontFamily: "Helvetica-Bold" }}>SEO</Text>
          <Text style={{ width: 34, fontFamily: "Helvetica-Bold" }}>GEO</Text>
          <Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>URL</Text>
          <Text style={{ width: 44, textAlign: "right", fontFamily: "Helvetica-Bold" }}>Words</Text>
        </View>
        {worst.map((p) => (
          <View key={p.url} style={[s.row, s.td]} wrap={false}>
            <Text style={{ width: 40 }}>{p.status || "ERR"}</Text>
            <Text style={{ width: 34, color: scoreColor(p.score ?? 0) }}>{p.score}</Text>
            <Text style={{ width: 34, color: p.geoScore === undefined ? C.subtle : scoreColor(p.geoScore) }}>{p.geoScore ?? "–"}</Text>
            <Text style={{ flex: 1 }}>{p.url}</Text>
            <Text style={{ width: 44, textAlign: "right" }}>{p.wordCount ?? ""}</Text>
          </View>
        ))}
        <Footer />
      </Page>
    </Document>
  );
}

export async function pageReportPdf(report: Report): Promise<Blob> {
  return pdf(<PageReportDoc report={report} />).toBlob();
}

export async function siteReportPdf(data: SiteReportData): Promise<Blob> {
  return pdf(<SiteReportDoc d={data} />).toBlob();
}
