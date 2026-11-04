"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProjectActions({ project, canDelete }: { project: { id: string; name: string; domain: string | null }; canDelete: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [domain, setDomain] = useState(project.domain ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const r = await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, domain: domain || null }) });
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Couldn't save.");
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete “${project.name}” and all its saved audits? This can't be undone.`)) return;
    const r = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!r.ok) return setError((await r.json()).error ?? "Couldn't delete.");
    router.push("/projects");
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-48" value={name} onChange={(e) => setName(e.target.value)} aria-label="Project name" />
        <input className="input w-48" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Domain" aria-label="Domain" />
        <button className="btn" onClick={save}>Save</button>
        <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
        {error && <p className="w-full text-sm text-fail">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
      {canDelete && <button className="btn-ghost hover:!border-fail/60 hover:!text-fail" onClick={remove}>Delete</button>}
      {error && <p className="text-sm text-fail">{error}</p>}
    </div>
  );
}
