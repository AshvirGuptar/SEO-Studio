"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "./session";

interface ProjectOption { id: string; name: string; domain: string | null }

export interface SavePayload {
  kind: "page" | "site";
  url: string;
  keyword?: string | null;
  score: number;
  issueCount: number;
  data: Record<string, unknown>;
}

/** "Save to project" control. Hidden entirely when sign-in isn't configured. */
export function SaveToProject({ payload, suggestedName }: { payload: SavePayload; suggestedName?: string }) {
  const { authEnabled, user } = useSession();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [projectId, setProjectId] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ projectId: string; auditId: string } | null>(null);

  const host = (() => { try { return new URL(payload.url).hostname; } catch { return ""; } })();

  useEffect(() => {
    if (!open || projects) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((list: ProjectOption[]) => {
        setProjects(list);
        const match = list.find((p) => p.domain && host && host.replace(/^www\./, "") === p.domain.replace(/^www\./, ""));
        setProjectId(match?.id ?? list[0]?.id ?? "new");
        setNewName(suggestedName ?? host);
      })
      .catch(() => setError("Couldn't load projects."));
  }, [open, projects, host, suggestedName]);

  if (!authEnabled || !user) return null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      let id = projectId;
      if (id === "new") {
        const r = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newName, domain: host || null }) });
        const p = await r.json();
        if (!r.ok) throw new Error(p.error ?? "Couldn't create project.");
        id = p.id;
      }
      const r = await fetch(`/api/projects/${id}/audits`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const a = await r.json();
      if (!r.ok) throw new Error(a.error ?? "Couldn't save.");
      setSaved({ projectId: id, auditId: a.id });
      setOpen(false);
      setProjects(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  if (saved && !open) {
    return (
      <span className="text-sm text-pass">
        ✓ Saved · <Link href={`/projects/${saved.projectId}/audits/${saved.auditId}`} className="underline hover:text-foreground">view</Link>
      </span>
    );
  }

  return (
    <div className="relative">
      <button className="btn-ghost" onClick={() => setOpen(!open)}>Save to project</button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-xl border border-border bg-surface p-4 shadow-2xl">
          {!projects && !error && <p className="text-sm text-muted">Loading projects…</p>}
          {projects && (
            <>
              <div>
                <label className="label" htmlFor="save-project">Project</label>
                <select id="save-project" className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  <option value="new">+ New project…</option>
                </select>
              </div>
              {projectId === "new" && (
                <div>
                  <label className="label" htmlFor="save-new">Project name</label>
                  <input id="save-new" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Client or site name" />
                </div>
              )}
              <button className="btn w-full" onClick={save} disabled={busy || (projectId === "new" && !newName.trim())}>{busy ? "Saving…" : "Save"}</button>
            </>
          )}
          {error && <p className="text-sm text-fail">{error}</p>}
        </div>
      )}
    </div>
  );
}
