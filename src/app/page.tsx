import Link from "next/link";
import { TOOLS } from "@/components/nav";

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">SEO Studio</h1>
      <p className="mt-1 text-muted">Internal toolkit for auditing pages, optimizing copy and building SEO-friendly URLs.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{t.name}</h2>
                {t.status === "soon" ? (
                  <span className="rounded bg-border px-2 py-0.5 text-xs text-muted">Coming soon</span>
                ) : (
                  <span className="text-accent">→</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted">{t.blurb}</p>
            </>
          );
          return t.status === "live" ? (
            <Link key={t.href} href={t.href} className="card transition hover:border-accent">{body}</Link>
          ) : (
            <div key={t.href} className="card opacity-60">{body}</div>
          );
        })}
      </div>
    </div>
  );
}
