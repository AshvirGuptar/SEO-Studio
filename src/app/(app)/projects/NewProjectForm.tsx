"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, domain: domain || null }) });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) return setError(data.error ?? "Couldn't create project.");
    router.push(`/projects/${data.id}`);
  }

  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <label className="label" htmlFor="pname">New project</label>
        <input id="pname" className="input" placeholder="Client or site name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="min-w-48 flex-1">
        <label className="label" htmlFor="pdomain">Domain (optional)</label>
        <input id="pdomain" className="input" placeholder="shop.example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
      </div>
      <button className="btn" disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
      {error && <p className="w-full text-sm text-fail">{error}</p>}
    </form>
  );
}
