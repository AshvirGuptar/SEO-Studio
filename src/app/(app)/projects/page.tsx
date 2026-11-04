import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/page-guard";
import { listProjects } from "@/lib/db/repo";
import { scoreColor } from "@/components/ScoreRing";
import { SetupNotice } from "@/components/SetupNotice";
import { Time } from "@/components/Time";
import { NewProjectForm } from "./NewProjectForm";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requirePageUser();
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Projects & History</h1>
      <p className="mt-1 text-muted">Group saved audits by site or client, track scores over time and see what changed between runs.</p>
      <div className="mt-6">{user ? <ProjectList /> : <SetupNotice feature="Projects & History" />}</div>
    </div>
  );
}

async function ProjectList() {
  const projects = await listProjects();
  return (
    <div className="space-y-6">
      <NewProjectForm />
      {projects.length === 0 ? (
        <div className="card text-sm text-muted">
          No projects yet. Create one above, or run the <Link href="/analyzer" className="text-accent hover:underline">Page Analyzer</Link> or{" "}
          <Link href="/audit" className="text-accent hover:underline">Site Audit</Link> and click <b className="text-foreground">Save to project</b>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card group transition hover:-translate-y-0.5 hover:border-accent/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{p.name}</h2>
                  <p className="truncate text-xs text-subtle">{p.domain ?? "No domain set"}</p>
                </div>
                {p.lastScore !== null && <span className="score-badge" style={{ background: scoreColor(p.lastScore) }}>{p.lastScore}</span>}
              </div>
              <p className="mt-4 text-xs text-muted">
                {p.auditCount} saved audit{p.auditCount === 1 ? "" : "s"}
                {p.lastAuditAt && <> · last <Time iso={p.lastAuditAt} relative /></>}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
