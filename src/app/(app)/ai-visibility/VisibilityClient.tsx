"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  estimateRunCost, formatBrandLine, LIMITS, parseBrandLine, parseCompetitors, parsePrompts, type BrandHit, type TrackedBrand,
} from "@/lib/seo/visibility";
import { formatUsd } from "@/lib/ai/pricing";
import type { SerializedRun } from "@/lib/ai/visibility-runner";
import type { BudgetStatus } from "@/lib/ai/budget";
import { scoreColor } from "@/components/ScoreRing";
import { VisibilityReport } from "./VisibilityReport";
import { StartOverButton } from "@/components/ResultActions";
import { Time } from "@/components/Time";
import { useSession } from "@/components/session";
import { downloadCsv } from "@/lib/csv";

interface ProjectOption { id: string; name: string; domain: string | null }

interface Payload {
  project: ProjectOption;
  setup: { prompts: string[]; brands: TrackedBrand[]; schedule: "off" | "weekly"; updatedAt: string } | null;
  runs: SerializedRun[];
  activeRunId: string | null;
  ai: { enabled: boolean; budget: BudgetStatus };
}

interface Form { prompts: string; own: string; competitors: string; schedule: "off" | "weekly" }

// Example data: the fictional "Example PC" store used across the app's samples.
const EXAMPLE: Form = {
  prompts: [
    "best graphics card for 1440p gaming",
    "where is the best place to buy a graphics card online",
    "best low profile graphics card for a small form factor PC",
    "is it cheaper to build a gaming PC or buy a prebuilt",
    "best online store for PC parts with fast shipping",
  ].join("\n"),
  own: "Example PC | example-pc.com",
  competitors: ["Newegg | newegg.com", "Micro Center | microcenter.com", "Best Buy | bestbuy.com", "Amazon | amazon.com"].join("\n"),
  schedule: "off",
};

const OTHER_ENGINES = ["ChatGPT search", "Perplexity", "Google Gemini"];

function formFromSetup(p: Payload): Form {
  if (!p.setup) return { prompts: "", own: p.project.domain ? `${p.project.name} | ${p.project.domain}` : p.project.name, competitors: "", schedule: "off" };
  const own = p.setup.brands.find((b) => b.own);
  return {
    prompts: p.setup.prompts.join("\n"),
    own: own ? formatBrandLine(own) : "",
    competitors: p.setup.brands.filter((b) => !b.own).map(formatBrandLine).join("\n"),
    schedule: p.setup.schedule,
  };
}


async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error(body?.error ?? `Request failed (${r.status}).`);
  return body as T;
}

export function VisibilityClient({ projects, initialProjectId, aiEnabled, model, maxSearches }: { projects: ProjectOption[]; initialProjectId: string; aiEnabled: boolean; model: string; maxSearches: number }) {
  const { user } = useSession();
  const [projectId, setProjectId] = useState(initialProjectId);
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [driving, setDriving] = useState<string | null>(null);
  const [viewRunId, setViewRunId] = useState<string | null>(null);
  /** null = automatic: open until the setup is saved and has results, then collapsed. */
  const [setupOpen, setSetupOpen] = useState<boolean | null>(null);
  const stopRef = useRef(false);

  const load = useCallback(async (id: string) => {
    const p = await api<Payload>(`/api/projects/${id}/visibility`);
    setData(p);
    return p;
  }, []);

  useEffect(() => {
    let live = true;
    api<Payload>(`/api/projects/${projectId}/visibility`)
      .then((p) => { if (live) { setData(p); setForm(formFromSetup(p)); } })
      .catch((e) => live && setError(e.message));
    const url = new URL(window.location.href);
    url.searchParams.set("project", projectId);
    window.history.replaceState(null, "", url);
    return () => { live = false; };
  }, [projectId]);

  // Stop driving a run if the person leaves the page.
  useEffect(() => () => { stopRef.current = true; }, []);

  const parsed = useMemo(() => {
    if (!form) return null;
    const own = parseBrandLine(form.own, true);
    const competitors = parseCompetitors(form.competitors);
    return { prompts: parsePrompts(form.prompts), brands: own ? [own, ...competitors] : competitors, own };
  }, [form]);

  const saved = data && form ? JSON.stringify(formFromSetup(data)) === JSON.stringify(form) : true;
  const estimate = estimateRunCost(parsed?.prompts.length ?? 0, model, maxSearches);
  const runs = data?.runs ?? [];
  const active = runs.find((r) => r.id === data?.activeRunId) ?? null;
  const shown = runs.find((r) => r.id === viewRunId) ?? runs[0] ?? null;
  const budget = data?.ai.budget;
  const canRun = aiEnabled && !!data?.setup && saved && !active && !driving && (budget?.ok ?? true);

  function switchProject(id: string) {
    setData(null);
    setForm(null);
    setError(null);
    setNotice(null);
    setViewRunId(null);
    setSetupOpen(null);
    setProjectId(id);
  }

  async function save() {
    if (!parsed?.own) return setError("Add your brand name.");
    if (parsed.prompts.length === 0) return setError("Add at least one prompt.");
    setSaving(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/visibility`, { method: "PUT", body: JSON.stringify({ prompts: parsed.prompts, brands: parsed.brands, schedule: form!.schedule }) });
      const p = await load(projectId);
      setForm(formFromSetup(p));
      setNotice("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  /** Answers the run's prompts one request at a time, refreshing results after each. */
  async function drive(runId: string) {
    setDriving(runId);
    setViewRunId(runId);
    stopRef.current = false;
    try {
      for (;;) {
        if (stopRef.current) break;
        const step = await api<{ kind: string; remaining: number }>(`/api/visibility/runs/${runId}/next`, { method: "POST" });
        const run = await api<SerializedRun>(`/api/visibility/runs/${runId}`);
        setData((d) => (d ? { ...d, runs: d.runs.map((r) => (r.id === runId ? run : r)) } : d));
        if (step.kind === "idle" || step.remaining === 0) break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The run stopped.");
    } finally {
      setDriving(null);
      await load(projectId).catch(() => {});
    }
  }

  async function start() {
    setError(null);
    setNotice(null);
    try {
      const run = await api<SerializedRun>(`/api/projects/${projectId}/visibility/runs`, { method: "POST" });
      setData((d) => (d ? { ...d, runs: [run, ...d.runs], activeRunId: run.id } : d));
      await drive(run.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the run.");
    }
  }

  async function stop(runId: string) {
    stopRef.current = true;
    try {
      await api(`/api/visibility/runs/${runId}`, { method: "PATCH", body: JSON.stringify({ action: "stop" }) });
      await load(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't stop the run.");
    }
  }

  async function remove(runId: string) {
    if (!confirm("Delete this run and its answers? This can't be undone.")) return;
    try {
      await api(`/api/visibility/runs/${runId}`, { method: "DELETE" });
      if (viewRunId === runId) setViewRunId(null);
      await load(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the run.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56">
          <label className="label" htmlFor="vis-project">Project</label>
          <select id="vis-project" className="input" value={projectId} onChange={(e) => switchProject(e.target.value)} disabled={!!driving}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <Link href={`/projects/${projectId}`} className="btn-ghost">Open project</Link>
      </div>

      {!aiEnabled && (
        <div className="card border-info/30 text-sm text-muted">
          <b className="text-foreground">AI isn&apos;t switched on yet.</b> You can set up prompts and brands now; running them needs an admin to add{" "}
          <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> in Vercel and redeploy.
        </div>
      )}
      {error && <div className="card border-fail/40 text-sm text-fail" role="alert">{error}</div>}

      {!data || !form || !parsed ? (
        !error && <div className="h-40 animate-pulse rounded-2xl bg-surface/60" />
      ) : (
        <>
          {/* ---------- run ---------- */}
          <section className="card flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-medium">Run {parsed.prompts.length} prompt{parsed.prompts.length === 1 ? "" : "s"} with Claude + web search</div>
              <div className="mt-1 text-muted">
                Estimated cost {formatUsd(estimate.lowMicros)}–{formatUsd(estimate.highMicros)} on {model}, up to {maxSearches} web search{maxSearches === 1 ? "" : "es"} per question.
                {budget && <> You&apos;ve used {formatUsd(budget.spentTodayMicros)} of your {formatUsd(budget.dailyUserMicros)} daily AI limit.</>}
              </div>
              {budget && !budget.ok && <div className="mt-1 text-fail">{budget.reason}</div>}
            </div>
            <div className="flex flex-wrap gap-2">
              {active && !driving && active.trigger === "manual" && (
                <button className="btn-ghost" onClick={() => drive(active.id)} disabled={!aiEnabled}>Continue run</button>
              )}
              {active && <button className="btn-ghost" onClick={() => stop(active.id)}>Stop</button>}
              <button className="btn" onClick={start} disabled={!canRun}
                title={!aiEnabled ? "Needs ANTHROPIC_API_KEY" : !saved ? "Save the setup first" : undefined}>
                {driving ? "Running…" : "Run now"}
              </button>
            </div>
          </section>

          {/* ---------- setup ---------- */}
          {!(setupOpen ?? (!data.setup || runs.length === 0 || !saved)) ? (
            <section className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <h2 className="font-medium">Questions and brands</h2>
                <p className="mt-1 text-muted">
                  {parsed.prompts.length} question{parsed.prompts.length === 1 ? "" : "s"} · tracking {parsed.own?.name ?? "your brand"} vs{" "}
                  {parsed.brands.length - 1} competitor{parsed.brands.length - 1 === 1 ? "" : "s"} · {form.schedule === "weekly" ? "re-runs weekly" : "manual runs"}
                </p>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setSetupOpen(true)}>Edit setup</button>
            </section>
          ) : (
          <section className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-medium">Questions and brands</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost" onClick={() => setForm(EXAMPLE)}>Load example</button>
                <StartOverButton label="Undo changes" onClick={() => { setForm(formFromSetup(data)); setError(null); setNotice(null); }} />
                {data.setup && runs.length > 0 && saved && <button type="button" className="btn-ghost" onClick={() => setSetupOpen(false)}>Done</button>}
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <label className="label" htmlFor="vis-prompts">Questions customers ask (one per line, up to {LIMITS.maxPrompts})</label>
                <textarea id="vis-prompts" className="input h-48 font-mono text-xs" value={form.prompts}
                  placeholder={"best graphics card for 1440p gaming\nwhere to buy a graphics card online"}
                  onChange={(e) => setForm({ ...form, prompts: e.target.value })} />
                <p className="mt-1 text-xs text-subtle">
                  Write them the way a shopper would, without your brand name. {parsed.prompts.length} prompt{parsed.prompts.length === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="vis-own">Your brand</label>
                  <input id="vis-own" className="input font-mono text-xs" value={form.own} placeholder="Example PC | example-pc.com | ExPC"
                    onChange={(e) => setForm({ ...form, own: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="vis-comp">Competitors (one per line, up to {LIMITS.maxCompetitors})</label>
                  <textarea id="vis-comp" className="input h-28 font-mono text-xs" value={form.competitors} placeholder={"Newegg | newegg.com\nMicro Center | microcenter.com"}
                    onChange={(e) => setForm({ ...form, competitors: e.target.value })} />
                  <p className="mt-1 text-xs text-subtle">Format: <span className="font-mono">Name | domain.com | other names</span>. The domain is how citations are matched.</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={form.schedule === "weekly"}
                    onChange={(e) => setForm({ ...form, schedule: e.target.checked ? "weekly" : "off" })} />
                  Re-run automatically every week
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <button className="btn" onClick={save} disabled={saving || saved || !!driving}>{saving ? "Saving…" : saved ? "Saved" : "Save setup"}</button>
              {notice && saved && <span className="text-sm text-pass">{notice}</span>}
              {!saved && <span className="text-sm text-warn">Unsaved changes</span>}
            </div>
          </section>
          )}

          {active && <Progress run={active} />}

          {/* ---------- results ---------- */}
          {shown ? (
            <>
              <VisibilityReport run={shown} runs={runs} onExport={() => exportRunCsv(shown)} />
              <section className="card overflow-x-auto p-0">
                <h2 className="p-4 font-medium">Answers by question</h2>
                <ul className="divide-y divide-border border-t border-border">
                  {shown.results.map((r) => <PromptRow key={r.id} r={r} />)}
                </ul>
              </section>
            </>
          ) : (
            <div className="card text-sm text-muted">No runs yet. Save your setup, then click <b className="text-foreground">Run now</b>.</div>
          )}

          {runs.length > 0 && (
            <RunHistory runs={runs} shownId={shown?.id ?? null} onShow={setViewRunId} onDelete={remove}
              canDelete={(r) => user?.role === "admin" || (!!user && r.createdBy === user.id)} busyId={driving} />
          )}

          <section className="card">
            <h2 className="font-medium">Other AI engines</h2>
            <p className="mt-1 text-sm text-muted">Results above come from Claude with web search. Other assistants answer differently and can be added later.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {OTHER_ENGINES.map((e) => (
                <li key={e} className="rounded-full border border-border px-3 py-1 text-xs text-subtle" title="Needs that provider's API key">{e} · add a key to enable</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Progress({ run }: { run: SerializedRun }) {
  const finished = run.results.filter((r) => r.status !== "pending" && r.status !== "running").length;
  const current = run.results.find((r) => r.status === "running");
  return (
    <div className="card" aria-live="polite">
      <div className="flex justify-between text-sm">
        <span>{current ? <>Asking: <span className="text-muted">“{current.prompt}”</span></> : "Waiting for the next prompt…"}</span>
        <span className="tabular-nums text-muted">{finished}/{run.promptCount}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-accent transition-all" style={{ width: `${(finished / Math.max(run.promptCount, 1)) * 100}%` }} />
      </div>
      {run.trigger === "scheduled" && <p className="mt-2 text-xs text-subtle">Scheduled run: it continues in the background.</p>}
    </div>
  );
}

function exportRunCsv(run: SerializedRun) {
  const header = ["prompt", "status", ...run.brands.flatMap((b) => [`${b.name} mentioned`, `${b.name} rank`, `${b.name} cited`]), "cited sources"];
  const rows = run.results.map((r) => {
    const hit = (name: string) => r.hits.find((h) => h.brand === name);
    return [
      r.prompt, r.status,
      ...run.brands.flatMap((b) => { const h = hit(b.name); return [h?.mentioned ? "yes" : "no", h?.rank ?? "", h?.cited ? "yes" : "no"]; }),
      r.citations.map((c) => c.url).join(" "),
    ];
  });
  downloadCsv(`ai-visibility-${run.createdAt.slice(0, 10)}.csv`, [header, ...rows]);
}

function PromptRow({ r }: { r: SerializedRun["results"][number] }) {
  const [open, setOpen] = useState(false);
  const own = r.hits.find((h: BrandHit) => h.own);
  const others = r.hits.filter((h: BrandHit) => !h.own && h.mentioned).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  return (
    <li className="p-4">
      <button type="button" className="flex w-full flex-wrap items-start justify-between gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}
        disabled={r.status !== "done" && r.status !== "error"}>
        <span className="min-w-0 flex-1 text-sm">{r.prompt}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs">
          {r.status === "done" && own && (
            <>
              <Status ok={own.mentioned} yes={own.rank ? `Mentioned #${own.rank}` : "Mentioned"} no="Not mentioned" />
              <Status ok={own.cited} yes="Cited" no="Not cited" />
            </>
          )}
          {r.status === "error" && <span className="text-fail">Error</span>}
          {(r.status === "pending" || r.status === "running") && <span className="text-subtle">{r.status === "running" ? "Asking…" : "Queued"}</span>}
          {r.status === "skipped" && <span className="text-subtle">Skipped</span>}
          {(r.status === "done" || r.status === "error") && <span className="text-subtle">{open ? "▲" : "▼"}</span>}
        </span>
      </button>
      {r.status === "done" && others.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
          Also named: {others.map((h) => <span key={h.brand} className="rounded-full bg-surface-2 px-2 py-0.5">#{h.rank} {h.brand}{h.cited ? " · cited" : ""}</span>)}
        </div>
      )}
      {open && (
        <div className="mt-3 space-y-3">
          {r.error && <p className="text-sm text-fail">{r.error}</p>}
          {r.answer && <div className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm text-muted">{r.answer}</div>}
          {r.citations.length > 0 && (
            <div>
              <div className="label">Cited sources</div>
              <ul className="space-y-1 text-xs">
                {r.citations.map((c) => (
                  <li key={c.url} className="break-all">
                    <a href={c.url} target="_blank" rel="noreferrer noopener" className="hover:text-accent">{c.title || c.url}</a>{" "}
                    <span className="text-subtle">{new URL(c.url).hostname}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.sources.length > r.citations.length && (
            <p className="text-xs text-subtle">{r.sources.length} search results looked at in total.</p>
          )}
          {r.model && <p className="text-xs text-subtle">Answered by {r.model} · {formatUsd(r.costMicros, 3)}</p>}
        </div>
      )}
    </li>
  );
}

function Status({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`rounded-full border px-2 py-0.5 ${ok ? "border-pass/30 text-pass" : "border-border text-subtle"}`}>{ok ? `✓ ${yes}` : no}</span>;
}

function RunHistory({ runs, shownId, onShow, onDelete, canDelete, busyId }: {
  runs: SerializedRun[]; shownId: string | null; onShow: (id: string) => void; onDelete: (id: string) => void;
  canDelete: (r: SerializedRun) => boolean; busyId: string | null;
}) {
  return (
    <section className="card overflow-x-auto p-0">
      <h2 className="p-4 font-medium">Run history</h2>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-y border-border text-left text-[11px] uppercase tracking-wide text-subtle">
          <tr><th className="p-3">Started</th><th className="p-3">Type</th><th className="p-3">Score</th><th className="p-3">Answered</th><th className="p-3 text-right">Cost</th><th className="p-3" /></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {runs.map((r) => (
            <tr key={r.id} className={r.id === shownId ? "bg-surface-2" : undefined}>
              <td className="p-3 text-xs"><button className="hover:text-accent" onClick={() => onShow(r.id)}><Time iso={r.createdAt} /></button></td>
              <td className="p-3 text-xs text-muted">{r.trigger === "scheduled" ? "Scheduled" : "Manual"}{r.status !== "done" && ` · ${r.status}`}</td>
              <td className="p-3">{r.summary.score === null ? <span className="text-xs text-subtle">—</span> : <span className="score-badge" style={{ background: scoreColor(r.summary.score) }}>{r.summary.score}</span>}</td>
              <td className="p-3 tabular-nums text-muted">{r.summary.answered}/{r.promptCount}</td>
              <td className="p-3 text-right tabular-nums text-muted">{formatUsd(r.costMicros)}</td>
              <td className="p-3 text-right">
                {canDelete(r) && r.id !== busyId && <button className="text-xs text-subtle hover:text-fail" onClick={() => onDelete(r.id)}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
