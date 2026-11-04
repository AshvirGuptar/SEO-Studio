"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { HELP_LINKS, TOOLS } from "./nav";

export function Sidebar() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:h-screen md:w-64 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:bg-surface/60 md:px-3 md:py-6">
      <Link href="/" className="mr-4 flex items-center gap-2.5 whitespace-nowrap px-2 font-semibold tracking-tight md:mb-8 md:mr-0">
        <Logo />
        <span>SEO <span className="text-accent">Studio</span></span>
      </Link>
      <span className="label hidden px-3 md:block">Tools</span>
      {TOOLS.map((t) => {
        if (t.status === "soon") {
          return (
            <span key={t.href} className="flex cursor-default items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-subtle">
              {t.name}
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">soon</span>
            </span>
          );
        }
        const active = path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative flex items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
              active ? "bg-accent-soft font-medium text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {active && <span className="absolute inset-y-2 left-0 hidden w-[3px] rounded-full bg-accent md:block" />}
            {t.name}
          </Link>
        );
      })}
      <span className="label mt-6 hidden px-3 md:block">Help</span>
      {HELP_LINKS.map((l) => {
        const active = path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href}
            className={`relative flex items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${active ? "bg-accent-soft font-medium text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"}`}>
            {active && <span className="absolute inset-y-2 left-0 hidden w-[3px] rounded-full bg-accent md:block" />}
            {l.name}
          </Link>
        );
      })}
    </nav>
  );
}
