import type { CrawlerAccess } from "@/lib/seo/geo";

/** Which AI crawlers robots.txt lets in. Status uses text + color, never color alone. */
export function CrawlerTable({ crawlers }: { crawlers: CrawlerAccess[] }) {
  const groups: { kind: CrawlerAccess["kind"]; title: string; note: string }[] = [
    { kind: "search", title: "AI search & answers", note: "Needed to be read and cited in AI answers." },
    { kind: "training", title: "Model training", note: "Optional; a business decision." },
  ];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.kind}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="label mb-1">{g.title}</h3>
            <span className="text-[11px] text-subtle">{g.note}</span>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-2/40 text-sm">
            {crawlers.filter((c) => c.kind === g.kind).map((c) => (
              <li key={c.token} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-xs">{c.token}</span>
                  <span className="block truncate text-xs text-subtle">{c.owner} · {c.product}</span>
                </span>
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${c.allowed ? "bg-pass/15 text-pass" : "bg-fail/15 text-fail"}`}>
                  {c.allowed ? "Allowed" : "Blocked"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
