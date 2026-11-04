import Link from "next/link";
import { TOOLS, toolStatus } from "@/components/nav";
import { isAuthEnabled } from "@/lib/auth/server";

export default function Home() {
  const authEnabled = isAuthEnabled();
  return (
    <div>
      <section className="pt-2 pb-10 md:pt-6">
        <span className="chip">Internal SEO toolkit</span>
        <h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
          Ship pages that{" "}
          <span className="bg-gradient-to-r from-[#ff8a5c] via-accent to-accent-deep bg-clip-text text-transparent">rank</span>.
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Audit any page, tune titles and product copy against a keyword, and clean up URLs. All in one place, built for our team.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/analyzer" className="btn">Analyze a page</Link>
          <Link href="/audit" className="btn-ghost">Audit a whole site</Link>
          <Link href="/guide" className="btn-ghost">How to use it</Link>
        </div>
      </section>

      <h2 className="label">Tools</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => {
          const status = toolStatus(t, authEnabled);
          const body = (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t.name}</h3>
                {status === "soon" ? (
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-subtle">Soon</span>
                ) : (
                  <span className="text-subtle transition group-hover:translate-x-0.5 group-hover:text-accent">→</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted">{t.blurb}</p>
            </>
          );
          return status === "live" ? (
            <Link key={t.href} href={t.href}
              className="card group transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_10px_40px_-12px_rgb(241_90_41/0.35)]">
              {body}
            </Link>
          ) : (
            <div key={t.href} className="card opacity-50">{body}</div>
          );
        })}
      </div>
    </div>
  );
}
