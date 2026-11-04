"use client";

import { useRef, useState } from "react";

export interface ScorePoint {
  date: string; // ISO
  score: number;
  label?: string;
}

const W = 720;
const H = 220;
const PAD = { top: 12, right: 16, bottom: 28, left: 34 };

/**
 * Single-series score-over-time line chart (0–100). 2px line, 8px markers, recessive grid,
 * crosshair + tooltip on hover. The audits table below it is the table view of the same data.
 */
export function ScoreChart({ points, title }: { points: ScorePoint[]; title: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const data = [...points].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  if (data.length === 0) return null;

  const t0 = +new Date(data[0].date);
  const t1 = +new Date(data[data.length - 1].date);
  const span = Math.max(t1 - t0, 1);
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (d: string) => (data.length === 1 ? PAD.left + iw / 2 : PAD.left + ((+new Date(d) - t0) / span) * iw);
  const y = (s: number) => PAD.top + (1 - s / 100) * ih;
  const path = data.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  function onMove(e: React.PointerEvent) {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < data.length; i++) if (Math.abs(x(data[i].date) - px) < Math.abs(x(data[best].date) - px)) best = i;
    setHover(best);
  }

  const h = hover !== null ? data[hover] : null;
  return (
    <figure className="relative">
      <figcaption className="label">{title}</figcaption>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img"
        aria-label={`${title}: ${data.map((p) => `${fmt(p.date)} ${p.score}`).join(", ")}`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {[0, 50, 80, 100].map((g) => (
          <g key={g}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeDasharray={g === 0 ? undefined : "3 4"} />
            <text x={PAD.left - 8} y={y(g)} textAnchor="end" dominantBaseline="central" fontSize="11" fill="var(--subtle)">{g}</text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} fontSize="11" fill="var(--subtle)">{fmt(data[0].date)}</text>
        {data.length > 1 && <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="11" fill="var(--subtle)">{fmt(data[data.length - 1].date)}</text>}
        {h && <line x1={x(h.date)} x2={x(h.date)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--border-strong)" />}
        <path d={path} fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((p, i) => (
          <circle key={i} cx={x(p.date)} cy={y(p.score)} r={hover === i ? 5.5 : 4} fill="var(--foreground)" stroke="var(--surface)" strokeWidth="2" />
        ))}
        {/* Direct label on the latest point */}
        <text x={x(data[data.length - 1].date)} y={y(data[data.length - 1].score) - 12} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--foreground)">
          {data[data.length - 1].score}
        </text>
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-6 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(x(h.date) / W) * 100}%`, transform: `translateX(${x(h.date) > W * 0.7 ? "-105%" : "8px"})` }}>
          <div className="font-semibold tabular-nums">Score {h.score}</div>
          <div className="text-muted">{new Date(h.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
          {h.label && <div className="max-w-56 truncate text-subtle">{h.label}</div>}
        </div>
      )}
    </figure>
  );
}

/** Tiny trend line for tables. Decorative; the number beside it carries the value. */
export function Sparkline({ scores, width = 80, height = 22 }: { scores: number[]; width?: number; height?: number }) {
  if (scores.length < 2) return <span className="text-xs text-subtle">—</span>;
  const step = width / (scores.length - 1);
  const pts = scores.map((s, i) => `${(i * step).toFixed(1)},${(2 + (1 - s / 100) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
