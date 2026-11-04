"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOOLS } from "./nav";

export function Sidebar() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-3 md:h-screen md:w-60 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:py-6 md:sticky md:top-0">
      <Link href="/" className="mr-4 flex items-center gap-2 whitespace-nowrap px-2 font-semibold md:mb-6 md:mr-0">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-bold text-white">SEO</span>
        SEO Studio
      </Link>
      {TOOLS.map((t) => {
        if (t.status === "soon") {
          return (
            <span key={t.href} className="flex cursor-default items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted/60">
              {t.name}
              <span className="rounded bg-border px-1.5 py-0.5 text-[10px] uppercase">soon</span>
            </span>
          );
        }
        const active = path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-accent-soft hover:text-foreground"
            }`}
          >
            {t.name}
          </Link>
        );
      })}
    </nav>
  );
}
