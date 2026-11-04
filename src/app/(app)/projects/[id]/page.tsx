import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page-guard";
import { getProject, listAudits } from "@/lib/db/repo";
import { scoreColor } from "@/components/ScoreRing";
import { ScoreChart, Sparkline } from "@/components/ScoreChart";
import { SetupNotice } from "@/components/SetupNotice";
import { Time } from "@/components/Time";
import { ProjectActions } from "./ProjectActions";
import { DeleteAuditButton } from "./DeleteAuditButton";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const user = await requirePageUser();
  if (!user) return <SetupNotice feature="Projects & History" />;
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const audits = await listAudits(id);

  const siteAudits = audits.filter((a) => a.kind === "site");
  // Page audits grouped by URL, newest first within each group.
  const byUrl = new Map<string, typeof audits>();
  for (const a of audits.filter((a) => a.kind === "page")) byUrl.set(a.url, [...(byUrl.get(a.url) ?? []), a]);
  const tracked = [...byUrl.entries()]
    .map(([url, list]) => ({ url, latest: list[0], previous: list[1], scores: list.map((a) => a.score).reverse(), count: list.length }))
    .sort((a, b) => +b.latest.createdAt - +a.latest.createdAt);
  const canManage = user.role === "admin" || project.createdBy === user.id;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projects" className="text-xs text-subtle hover:text-accent">← Projects</Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <p className="text-sm text-subtle">{project.domain ?? "No domain set"}</p>
          </div>
          <ProjectActions project={{ id: project.id, name: project.name, domain: project.domain }} canDelete={canManage} />
        </div>
      </div>

      {audits.length === 0 && (
        <div className="card text-sm text-muted">
          Nothing saved yet. Run the <Link href="/analyzer" className="text-accent hover:underline">Page Analyzer</Link> or{" "}
          <Link href="/audit" className="text-accent hover:underline">Site Audit</Link>, then click <b className="text-foreground">Save to project</b>.
          Save again after making changes to track progress.
        </div>
      )}

      {siteAudits.length > 0 && (
        <div className="card">
          <ScoreChart title="Site health over time" points={siteAudits.map((a) => ({ date: a.createdAt.toISOString(), score: a.score, label: a.url }))} />
        </div>
      )}

      {tracked.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <h2 className="p-4 font-medium">Tracked pages</h2>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-y border-border text-left text-[11px] uppercase tracking-wide text-subtle">
              <tr><th className="p-3">Page</th><th className="p-3">Score</th><th className="p-3">Change</th><th className="p-3">Trend</th><th className="p-3 text-right">Last checked</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tracked.map((t) => {
                const delta = t.previous ? t.latest.score - t.previous.score : null;
                return (
                  <tr key={t.url}>
                    <td className="max-w-sm p-3">
                      <Link href={`/projects/${id}/audits/${t.latest.id}`} className="block break-all font-mono text-xs hover:text-accent">{t.url}</Link>
                      {t.latest.keyword && <span className="text-xs text-subtle">“{t.latest.keyword}” · </span>}
                      <span className="text-xs text-subtle">{t.count} check{t.count === 1 ? "" : "s"}</span>
                    </td>
                    <td className="p-3"><span className="score-badge" style={{ background: scoreColor(t.latest.score) }}>{t.latest.score}</span></td>
                    <td className="p-3 tabular-nums"><Delta value={delta} /></td>
                    <td className="p-3"><Sparkline scores={t.scores} /></td>
                    <td className="p-3 text-right text-xs text-muted"><Time iso={t.latest.createdAt} relative /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {audits.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <h2 className="p-4 font-medium">All saved audits</h2>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-y border-border text-left text-[11px] uppercase tracking-wide text-subtle">
              <tr><th className="p-3">Saved</th><th className="p-3">Type</th><th className="p-3">URL</th><th className="p-3">Score</th><th className="p-3 text-right">Issues</th><th className="p-3">By</th><th className="p-3" /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {audits.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap p-3 text-xs text-muted"><Time iso={a.createdAt} /></td>
                  <td className="p-3 text-xs">{a.kind === "site" ? "Site audit" : "Page"}</td>
                  <td className="max-w-xs p-3"><Link href={`/projects/${id}/audits/${a.id}`} className="break-all font-mono text-xs hover:text-accent">{a.url}</Link></td>
                  <td className="p-3"><span className="score-badge" style={{ background: scoreColor(a.score) }}>{a.score}</span></td>
                  <td className="p-3 text-right tabular-nums text-muted">{a.issueCount}</td>
                  <td className="p-3 text-xs text-muted">{a.createdByName ?? "—"}</td>
                  <td className="p-3 text-right">{(user.role === "admin" || a.createdBy === user.id) && <DeleteAuditButton id={a.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-subtle">first check</span>;
  if (value === 0) return <span className="text-xs text-muted">no change</span>;
  return <span className={`text-xs font-medium ${value > 0 ? "text-pass" : "text-fail"}`}>{value > 0 ? "▲" : "▼"} {Math.abs(value)}</span>;
}
