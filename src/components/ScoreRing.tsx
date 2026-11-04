import type { ScoreSummary } from "@/lib/seo/types";

export function scoreColor(score: number) {
  return score >= 80 ? "var(--pass)" : score >= 60 ? "var(--warn)" : "var(--fail)";
}

export function ScoreRing({ summary, size = 120, label = "SEO score", legend }: { summary: ScoreSummary; size?: number; label?: string; legend?: React.ReactNode }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(summary.score);
  return (
    <div className="flex min-w-0 items-center gap-4 sm:gap-5">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto shrink-0" style={{ width: `min(${size}px, 26vw)` }} role="img" aria-label={`${label}: ${summary.score} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - summary.score / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s", filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size / 3.6} fontWeight={600} fill="var(--foreground)">
          {summary.score}
        </text>
      </svg>
      <div className="min-w-0 text-sm">
        <div className="text-muted">{label}</div>
        <div className="text-2xl font-semibold" style={{ color }}>Grade {summary.grade}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
          {legend ?? (
            <>
              <span><b className="text-pass">{summary.counts.pass}</b> passed</span>
              <span><b className="text-warn">{summary.counts.warn}</b> warnings</span>
              <span><b className="text-fail">{summary.counts.fail}</b> failed</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
