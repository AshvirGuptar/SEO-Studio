import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page-guard";
import { getAudit, getPreviousAudit, getProject } from "@/lib/db/repo";
import { comparePageChecks, compareSiteIssues } from "@/lib/seo/compare";
import { ReportView, type Report } from "../../../../analyzer/AnalyzerClient";
import { Results, type SiteResultsData } from "../../../../audit/AuditClient";
import { SetupNotice } from "@/components/SetupNotice";
import { Time } from "@/components/Time";

export const metadata: Metadata = { title: "Saved audit" };

type SiteData = SiteResultsData;

export default async function SavedAuditPage({ params }: PageProps<"/projects/[id]/audits/[auditId]">) {
  const user = await requirePageUser();
  if (!user) return <SetupNotice feature="Projects & History" />;
  const { id, auditId } = await params;
  const [project, audit] = await Promise.all([getProject(id), getAudit(auditId)]);
  if (!project || !audit || audit.projectId !== id) notFound();
  const previous = await getPreviousAudit(audit);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/projects/${id}`} className="text-xs text-subtle hover:text-accent">← {project.name}</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{audit.kind === "site" ? "Site audit" : "Page audit"}</h1>
        <p className="break-all text-sm text-muted">
          <span className="font-mono text-xs">{audit.url}</span> · saved <Time iso={audit.createdAt} />
          {audit.keyword && <> · keyword “{audit.keyword}”</>}
        </p>
      </div>

      {previous ? (
        audit.kind === "page" ? (
          <PageChanges prev={previous.data as { report: Report }} curr={audit.data as { report: Report }} prevDate={previous.createdAt} />
        ) : (
          <SiteChanges prev={previous.data as SiteData} curr={audit.data as SiteData} prevDate={previous.createdAt} />
        )
      ) : (
        <div className="card text-sm text-muted">This is the first saved {audit.kind === "site" ? "site audit" : "check"} of this URL. Save it again after making changes to see what improved.</div>
      )}

      {audit.kind === "page" ? (
        <ReportView report={(audit.data as { report: Report }).report} saveable={false} />
      ) : (
        <Results data={withGeoDefault(audit.data as SiteData)} />
      )}
    </div>
  );
}

function ChangeCard({ title, delta, prevDate, children }: { title: string; delta: number; prevDate: Date; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        <span className="text-xs text-subtle">compared with <Time iso={prevDate} /></span>
      </div>
      <p className="mt-1 text-sm">
        Score{" "}
        {delta === 0 ? <span className="text-muted">unchanged</span> : (
          <span className={`font-semibold ${delta > 0 ? "text-pass" : "text-fail"}`}>{delta > 0 ? "▲ up" : "▼ down"} {Math.abs(delta)} points</span>
        )}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">{children}</div>
    </div>
  );
}

function Column({ title, tone, items }: { title: string; tone: "pass" | "fail" | "warn"; items: { key: string; text: string; detail?: string }[] }) {
  const cls = tone === "pass" ? "text-pass" : tone === "fail" ? "text-fail" : "text-warn";
  return (
    <div>
      <h3 className={`label ${cls}`}>{title} ({items.length})</h3>
      {items.length === 0 ? <p className="text-sm text-subtle">None</p> : (
        <ul className="space-y-1 text-sm">
          {items.map((i) => <li key={i.key}>{i.text}{i.detail && <span className="text-subtle"> {i.detail}</span>}</li>)}
        </ul>
      )}
    </div>
  );
}

function PageChanges({ prev, curr, prevDate }: { prev: { report: Report }; curr: { report: Report }; prevDate: Date }) {
  const d = comparePageChecks(
    { score: prev.report.summary.score, checks: prev.report.checks },
    { score: curr.report.summary.score, checks: curr.report.checks },
  );
  return (
    <ChangeCard title="What changed since the last check" delta={d.scoreDelta} prevDate={prevDate}>
      <Column title="✓ Fixed" tone="pass" items={d.fixed.map((c) => ({ key: c.id, text: c.label }))} />
      <Column title="✕ New issues" tone="fail" items={d.introduced.map((c) => ({ key: c.id, text: c.label }))} />
      <Column title="! Got worse" tone="warn" items={d.worsened.map((c) => ({ key: c.id, text: c.label }))} />
    </ChangeCard>
  );
}

function SiteChanges({ prev, curr, prevDate }: { prev: SiteData; curr: SiteData; prevDate: Date }) {
  const total = (i: { items: unknown[]; total?: number }) => i.total ?? i.items.length;
  const withTotals = (a: SiteData["audit"]) => a.issues.map((i) => ({ ...i, items: Array.from({ length: total(i as typeof i & { total?: number }) }, () => ({ url: "" })) }));
  const d = compareSiteIssues(withTotals(prev.audit), withTotals(curr.audit));
  const better = d.changed.filter((c) => c.after < c.before);
  const worse = d.changed.filter((c) => c.after > c.before);
  return (
    <ChangeCard title="What changed since the last audit" delta={curr.audit.healthScore - prev.audit.healthScore} prevDate={prevDate}>
      <Column title="✓ Resolved or reduced" tone="pass" items={[...d.resolved, ...better].map((c) => ({ key: c.id, text: c.label, detail: `${c.before} → ${c.after}` }))} />
      <Column title="✕ New issue types" tone="fail" items={d.added.map((c) => ({ key: c.id, text: c.label, detail: `${c.after}` }))} />
      <Column title="! Increased" tone="warn" items={worse.map((c) => ({ key: c.id, text: c.label, detail: `${c.before} → ${c.after}` }))} />
    </ChangeCard>
  );
}

/** Site audits saved before GEO existed have no avgGeoScore. */
function withGeoDefault(d: SiteData): SiteData {
  return { ...d, audit: { ...d.audit, avgGeoScore: d.audit.avgGeoScore ?? null } };
}
