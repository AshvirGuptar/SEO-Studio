/** Small decorative illustrations for the homepage feature cards (theme tokens only). */
export function ToolIcon({ href }: { href: string }) {
  const paths: Record<string, React.ReactNode> = {
    "/analyzer": <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /><path d="M8 11h6M11 8v6" /></>,
    "/content": <><path d="M4 6h16M4 12h10M4 18h7" /><path d="m15 18 2 2 4-4" /></>,
    "/urls": <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
    "/audit": <><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-2h12v2" /></>,
    "/keywords": <><circle cx="8" cy="9" r="4" /><circle cx="16.5" cy="7.5" r="2.5" /><circle cx="15" cy="16" r="4.5" /></>,
    "/ai-visibility": <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /><path d="M9 11h.01M12 11h.01M15 11h.01" /></>,
    "/projects": <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>,
  };
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent/30 bg-accent-soft text-accent">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {paths[href]}
      </svg>
    </span>
  );
}

function MiniRing({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 17, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-2">
      <svg width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 22 22)" className="transition-all duration-700 group-hover:[stroke-dashoffset:0]" />
        <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="600" fill="var(--foreground)">{value}</text>
      </svg>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

export function ToolPreview({ href }: { href: string }) {
  switch (href) {
    case "/analyzer":
      return (
        <div className="flex h-full items-center justify-center gap-5">
          <MiniRing value={86} label="SEO" color="var(--pass)" />
          <MiniRing value={72} label="GEO" color="var(--warn)" />
        </div>
      );
    case "/content":
      return (
        <div className="space-y-1.5 px-4 py-3 font-[arial,sans-serif]">
          <div className="text-[10px] text-subtle">example-arms.com › ar15-charging-handle</div>
          <div className="truncate text-[13px] text-[#99c3ff]">AR-15 Charging Handle – Mil-Spec 7075</div>
          <div className="h-1.5 w-11/12 rounded bg-surface-2" />
          <div className="h-1.5 w-8/12 rounded bg-surface-2" />
          <div className="flex gap-1.5 pt-1">
            {["58/60 chars", "keyword ✓", "CTA ✓"].map((t) => <span key={t} className="rounded bg-pass/15 px-1.5 text-[9px] text-pass">{t}</span>)}
          </div>
        </div>
      );
    case "/urls":
      return (
        <div className="flex h-full flex-col justify-center gap-2 px-4 font-mono text-[10.5px]">
          <span className="truncate text-fail/80 line-through">/Products/AR15_CH_10045.html</span>
          <span className="text-subtle">↓ 301</span>
          <span className="truncate text-pass">/ar15-charging-handle/ambidextrous</span>
        </div>
      );
    case "/audit":
      return (
        <svg viewBox="0 0 200 90" className="h-full w-full" aria-hidden="true">
          <g stroke="var(--border-strong)" strokeWidth="1.5" fill="none">
            <path d="M100 18v14M100 32H40v14M100 32h60v14M100 32v14M40 56v12M28 68h24M160 56v12" />
          </g>
          {[[100, 14, "var(--pass)"], [40, 50, "var(--pass)"], [100, 50, "var(--warn)"], [160, 50, "var(--pass)"], [28, 72, "var(--pass)"], [52, 72, "var(--fail)"], [160, 72, "var(--pass)"]].map(([x, y, c], i) => (
            <rect key={i} x={Number(x) - 9} y={Number(y) - 5} width="18" height="10" rx="3" fill={String(c)} opacity=".85" />
          ))}
          <text x="62" y="86" fontSize="8" fill="var(--fail)">404</text>
        </svg>
      );
    case "/keywords":
      return (
        <svg viewBox="0 0 200 90" className="h-full w-full" aria-hidden="true">
          {[[60, 46, 26, "var(--intent-commercial)"], [118, 38, 18, "var(--intent-transactional)"], [150, 62, 13, "var(--intent-informational)"], [100, 70, 10, "var(--intent-commercial)"], [30, 22, 9, "var(--intent-informational)"]].map(([x, y, r, c], i) => (
            <circle key={i} cx={Number(x)} cy={Number(y)} r={Number(r)} fill={String(c)} fillOpacity=".25" stroke={String(c)} strokeWidth="1.5"
              className="origin-center transition-transform duration-500 group-hover:scale-110" style={{ transformBox: "fill-box" }} />
          ))}
        </svg>
      );
    case "/ai-visibility":
      return (
        <div className="flex h-full flex-col justify-center gap-2 px-4">
          <div className="max-w-[85%] self-end rounded-xl rounded-br-sm bg-surface-2 px-2.5 py-1.5 text-[10.5px]">best ar15 charging handle?</div>
          <div className="max-w-[90%] rounded-xl rounded-bl-sm border border-border px-2.5 py-1.5 text-[10.5px] text-muted">
            Top picks include the Example Arms Ambi <span className="rounded bg-accent-soft px-1 text-accent">[1]</span>…
          </div>
        </div>
      );
    case "/projects":
      return (
        <svg viewBox="0 0 200 90" className="h-full w-full" aria-hidden="true">
          <path d="M10 70 L50 62 L90 66 L130 40 L170 30 L190 22" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" className="draw" style={{ ["--len" as string]: 220 }} />
          {[[10, 70], [50, 62], [90, 66], [130, 40], [170, 30], [190, 22]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="var(--foreground)" />)}
          <text x="150" y="16" fontSize="9" fill="var(--pass)">▲ +24</text>
        </svg>
      );
    default:
      return null;
  }
}
