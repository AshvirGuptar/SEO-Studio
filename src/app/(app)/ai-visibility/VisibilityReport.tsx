"use client";

import { useMemo } from "react";
import type { SerializedRun } from "@/lib/ai/visibility-runner";
import { formatUsd } from "@/lib/ai/pricing";
import { runHeadline, scoreDelta, topCitedSources, visibilityGaps } from "@/lib/seo/visibility-insights";
import { scoreColor } from "@/components/ScoreRing";
import { ScoreChart } from "@/components/ScoreChart";
import { Time } from "@/components/Time";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Words next to the score so its status is never shown by color alone. */
function scoreWord(score: number): string {
  return score >= 80 ? "Strong" : score >= 60 ? "Fair" : score >= 30 ? "Weak" : "Low";
}

/**
 * The results of one run: headline score, share of voice, the sites the AI cites, a prompt-by-brand
 * coverage grid and the questions where competitors appear without you. Tables below the charts
 * (coverage grid, answers, run history) are the table views of the same data.
 */
export function VisibilityReport({ run, runs, onExport }: { run: SerializedRun; runs: SerializedRun[]; onExport: () => void }) {
  const s = run.summary;
  const done = useMemo(() => run.results.filter((r) => r.status === "done"), [run.results]);
  const finished = runs.filter((r) => r.summary.score !== null && r.status !== "running");
  const previous = finished.filter((r) => +new Date(r.createdAt) < +new Date(run.createdAt))[0];
  const delta = scoreDelta(s.score, previous?.summary.score);
  const sources = useMemo(() => topCitedSources(done, run.brands), [done, run.brands]);
  const gaps = useMemo(() => visibilityGaps(done), [done]);
  const trend = finished.map((r) => ({ date: r.createdAt, score: r.summary.score!, label: `${r.summary.answered} prompts` }));

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-medium">AI visibility report</h2>
            <p className="text-xs text-subtle">
              Run from <Time iso={run.createdAt} /> · {s.answered} of {run.promptCount} questions answered · {run.trigger === "scheduled" ? "scheduled" : "manual"} · cost {formatUsd(run.costMicros)}
              {run.status === "stopped" && " · stopped early"}
            </p>
          </div>
          <button className="btn-ghost" onClick={onExport}>Export CSV</button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
          <ScoreGauge score={s.score} delta={delta} />
          <div className="min-w-0 space-y-4">
            <p className="text-sm text-muted">{runHeadline(s)}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="Named in answers" value={s.own ? `${s.own.promptsMentioned}/${s.answered}` : "—"} hint={s.own ? `${pct(s.own.mentionRate)} of questions` : undefined} />
              <Stat label="Your site cited" value={s.own ? `${s.own.promptsCited}/${s.answered}` : "—"} hint={s.own ? `${pct(s.own.citationRate)} of questions` : undefined} />
              <Stat label="Average position" value={s.own?.avgRank ? `#${s.own.avgRank}` : "—"} hint="Order named, among tracked brands" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ShareOfVoice run={run} />
        <CitedSources sources={sources} answered={s.answered} />
      </div>

      <CoverageGrid run={run} />

      <div className={`grid gap-6 ${trend.length >= 2 ? "xl:grid-cols-2" : ""}`}>
        <Gaps gaps={gaps} answered={s.answered} />
        {trend.length >= 2 && (
          <section className="card">
            <ScoreChart title="Visibility score over time" points={trend} />
          </section>
        )}
      </div>
    </div>
  );
}

function ScoreGauge({ score, delta }: { score: number | null; delta: number | null }) {
  const size = 148;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = score ?? 0;
  const color = score === null ? "var(--border)" : scoreColor(score);
  return (
    <div className="flex items-center gap-5">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto shrink-0" style={{ width: `min(${size}px, 36vw)` }} role="img"
        aria-label={score === null ? "Visibility score: not available" : `Visibility score ${score} out of 100, ${scoreWord(score)}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .6s" }} />
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" fontSize={size / 3.4} fontWeight={600} fill="var(--foreground)">
          {score ?? "—"}
        </text>
        <text x="50%" y="68%" textAnchor="middle" dominantBaseline="central" fontSize={12} fill="var(--subtle)">out of 100</text>
      </svg>
      <div className="text-sm">
        <div className="label mb-1">Visibility score</div>
        {score !== null && <div className="text-xl font-semibold">{scoreWord(score)}</div>}
        {delta !== null && (
          <div className="mt-1 text-xs text-muted">
            <span aria-hidden="true">{delta > 0 ? "▲" : delta < 0 ? "▼" : "■"}</span>{" "}
            {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta}`} vs last run
          </div>
        )}
        <div className="mt-1 text-xs text-subtle">60% named + 40% cited</div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/60 p-3">
      <div className="label mb-1">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-subtle">{hint}</div>}
    </div>
  );
}

/** Ranked bars, your brand in foreground ink and competitors recessive; names are direct labels. */
function ShareOfVoice({ run }: { run: SerializedRun }) {
  const rows = [...run.summary.brands].sort((a, b) => b.shareOfVoice - a.shareOfVoice || Number(b.own) - Number(a.own));
  const max = Math.max(...rows.map((b) => b.shareOfVoice), 0.0001);
  return (
    <section className="card">
      <h2 className="font-medium">Share of voice</h2>
      <p className="mt-1 text-xs text-subtle">Each brand&apos;s share of all tracked-brand mentions in this run.</p>
      <ol className="mt-4 space-y-3">
        {rows.map((b, i) => (
          <li key={b.brand} title={`${b.brand}: ${pct(b.shareOfVoice)} of mentions, named in ${b.promptsMentioned} answers, cited in ${b.promptsCited}`}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className={`min-w-0 truncate ${b.own ? "font-semibold text-foreground" : "text-muted"}`}>
                <span className="mr-2 text-xs tabular-nums text-subtle">{i + 1}</span>{b.brand}
                {b.own && <span className="ml-2 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-foreground">You</span>}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-muted">{pct(b.shareOfVoice)}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(b.shareOfVoice / max) * 100}%`, background: b.own ? "var(--foreground)" : "var(--subtle)" }} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CitedSources({ sources, answered }: { sources: ReturnType<typeof topCitedSources>; answered: number }) {
  const max = Math.max(...sources.map((x) => x.answers), 1);
  return (
    <section className="card">
      <h2 className="font-medium">Sites the AI cites</h2>
      <p className="mt-1 text-xs text-subtle">Where the answers get their information. Being one of these sources is how you earn citations.</p>
      {sources.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No citations in this run.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {sources.map((x) => (
            <li key={x.domain} title={`${x.domain}: cited in ${x.answers} of ${answered} answers`}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className={`min-w-0 truncate ${x.own ? "font-semibold text-foreground" : "text-muted"}`}>
                  {x.domain}
                  {x.own ? (
                    <span className="ml-2 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-foreground">You</span>
                  ) : x.brand ? (
                    <span className="ml-2 text-xs text-subtle">{x.brand}</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-xs text-muted">{x.answers}/{answered}</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                <div className="h-full rounded-full" style={{ width: `${(x.answers / max) * 100}%`, background: x.own ? "var(--foreground)" : "var(--subtle)" }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Prompt × brand grid: the order each brand was named in, and whether its site was cited. */
function CoverageGrid({ run }: { run: SerializedRun }) {
  const brands = [...run.brands].sort((a, b) => Number(b.own) - Number(a.own));
  const rows = run.results.filter((r) => r.status === "done");
  if (rows.length === 0) return null;
  return (
    <section className="card overflow-hidden p-0">
      <div className="p-4">
        <h2 className="font-medium">Who shows up for each question</h2>
        <p className="mt-1 text-xs text-subtle">
          <span className="font-mono">#1</span> = named first among tracked brands · <span aria-hidden="true">↗</span> = their site was cited · — = not named
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-t border-border text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-subtle">
            <tr>
              <th scope="col" className="p-3 font-medium">Question</th>
              {brands.map((b) => (
                <th key={b.name} scope="col" className={`p-3 text-center font-medium ${b.own ? "text-foreground" : ""}`}>{b.own ? `${b.name} (you)` : b.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border border-t border-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="max-w-[320px] p-3 text-left font-normal text-muted">{r.prompt}</th>
                {brands.map((b) => {
                  const h = r.hits.find((x) => x.brand === b.name);
                  const label = !h?.mentioned ? (h?.cited ? "Not named, site cited" : "Not named") : `Named #${h.rank}${h.cited ? ", site cited" : ""}`;
                  return (
                    <td key={b.name} className={`p-2 text-center ${b.own ? "bg-surface-2/40" : ""}`} title={`${b.name}: ${label}`}>
                      {h?.mentioned ? (
                        <span className={`inline-flex min-w-12 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-xs tabular-nums ${b.own ? "border-foreground/40 font-semibold text-foreground" : "border-border text-muted"}`}>
                          #{h.rank}{h.cited && <span aria-hidden="true">↗</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-subtle">{h?.cited ? <span aria-hidden="true">↗</span> : "—"}</span>
                      )}
                      <span className="sr-only">{label}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Gaps({ gaps, answered }: { gaps: ReturnType<typeof visibilityGaps>; answered: number }) {
  return (
    <section className="card">
      <h2 className="font-medium">Biggest openings</h2>
      <p className="mt-1 text-xs text-subtle">Questions where competitors are named and you aren&apos;t: start your content work here.</p>
      {gaps.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {answered === 0 ? "No answers yet." : "None: every answer that names a competitor also names you."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {gaps.slice(0, 5).map((g) => (
            <li key={g.prompt} className="rounded-xl border border-border bg-surface-2/40 p-3">
              <div className="text-sm">“{g.prompt}”</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-muted">
                Named instead: {g.competitors.map((c) => <span key={c} className="rounded-full bg-surface-2 px-2 py-0.5">{c}</span>)}
              </div>
            </li>
          ))}
          {gaps.length > 5 && <li className="text-xs text-subtle">+{gaps.length - 5} more in the answers below.</li>}
        </ul>
      )}
    </section>
  );
}
