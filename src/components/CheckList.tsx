"use client";

import { useMemo, useState } from "react";
import type { Check, Severity } from "@/lib/seo/types";

const ICON: Record<Severity, { glyph: string; cls: string; label: string }> = {
  fail: { glyph: "✕", cls: "bg-fail/15 text-fail", label: "Failed" },
  warn: { glyph: "!", cls: "bg-warn/15 text-warn", label: "Warning" },
  pass: { glyph: "✓", cls: "bg-pass/15 text-pass", label: "Passed" },
  info: { glyph: "i", cls: "bg-info/15 text-info", label: "Info" },
};
const ORDER: Severity[] = ["fail", "warn", "info", "pass"];

export function CheckList({ checks, groupByCategory = true }: { checks: Check[]; groupByCategory?: boolean }) {
  const [filter, setFilter] = useState<"issues" | "all">("issues");

  const visible = useMemo(() => {
    const list = filter === "issues" ? checks.filter((c) => c.severity === "fail" || c.severity === "warn") : checks;
    // Most important first: severity, then weight.
    return [...list].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity) || b.weight - a.weight);
  }, [checks, filter]);

  const groups = useMemo(() => {
    if (!groupByCategory) return [["", visible]] as const;
    const m = new Map<string, Check[]>();
    for (const c of visible) m.set(c.category, [...(m.get(c.category) ?? []), c]);
    return [...m.entries()];
  }, [visible, groupByCategory]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {(["issues", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs ${filter === f ? "bg-accent text-white" : "bg-border/60 text-muted"}`}>
            {f === "issues" ? `Issues (${checks.filter((c) => c.severity === "fail" || c.severity === "warn").length})` : `All checks (${checks.length})`}
          </button>
        ))}
      </div>
      {visible.length === 0 && <p className="text-sm text-muted">No issues found. Nice work.</p>}
      <div className="space-y-5">
        {groups.map(([cat, items]) => (
          <div key={cat}>
            {cat && <h3 className="label">{cat}</h3>}
            <ul className="divide-y divide-border rounded-lg border border-border">
              {items.map((c) => (
                <li key={c.id} className="flex gap-3 p-3">
                  <span aria-label={ICON[c.severity].label}
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ICON[c.severity].cls}`}>
                    {ICON[c.severity].glyph}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium">{c.label}</span>
                      {c.value && <span className="truncate font-mono text-xs text-muted">{c.value}</span>}
                    </div>
                    <p className="text-muted">{c.message}</p>
                    {c.fix && <p className="mt-1 text-foreground"><span className="font-medium text-accent">Fix: </span>{c.fix}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
