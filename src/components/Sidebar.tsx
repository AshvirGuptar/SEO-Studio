"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Wordmark } from "./Wordmark";
import { HELP_LINKS, TOOLS, toolStatus } from "./nav";
import type { SessionUser } from "./session";
import { SignOutButton } from "./SignOutButton";

type Props = { authEnabled: boolean; user: SessionUser | null };

/**
 * Navigation. Below the lg breakpoint (phones, tablets in portrait): a top bar with a Menu button
 * that opens a full-width panel. From lg up: the fixed left sidebar.
 */
export function Sidebar(props: Props) {
  // usePathname() suspends on dynamic routes during prerender (cacheComponents), so the
  // fallback is the same navigation without an active item.
  return (
    <Suspense fallback={<Nav {...props} path="" />}>
      <NavWithPath {...props} />
    </Suspense>
  );
}

function NavWithPath(props: Props) {
  return <Nav {...props} path={usePathname()} />;
}

function Nav({ authEnabled, user, path }: Props & { path: string }) {
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  // Close the mobile menu after navigating (state reset on path change, no effect needed).
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" className="py-1" aria-label="Home"><Wordmark size={26} /></Link>
        <button
          type="button"
          className="btn-ghost min-h-10 px-3"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          {open ? "Close" : "Menu"}
        </button>
      </header>
      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-[57px] z-20 overflow-y-auto bg-background/97 px-4 pb-8 pt-4 backdrop-blur lg:hidden">
          <NavLinks authEnabled={authEnabled} user={user} path={path} />
        </div>
      )}

      {/* Desktop sidebar */}
      <nav aria-label="Main" className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface/60 px-3 py-6 lg:flex">
        <Link href="/" className="mb-8 px-2 py-1"><Wordmark /></Link>
        <NavLinks authEnabled={authEnabled} user={user} path={path} />
      </nav>
    </>
  );
}

function NavLink({ href, name, active }: { href: string; name: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 items-center whitespace-nowrap rounded-xl px-3 text-[15px] transition lg:min-h-9 lg:text-sm ${
        active ? "bg-accent-soft font-medium text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
      {name}
    </Link>
  );
}

function NavLinks({ authEnabled, user, path }: Props & { path: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="label px-3">Tools</span>
      {TOOLS.map((t) =>
        toolStatus(t, authEnabled) === "soon" ? (
          <span key={t.href} title={t.needsAuth ? "Available once sign-in is set up" : undefined}
            className="flex min-h-11 cursor-default items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 text-[15px] text-subtle lg:min-h-9 lg:text-sm">
            {t.name}
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] uppercase tracking-wide">soon</span>
          </span>
        ) : (
          <NavLink key={t.href} href={t.href} name={t.name} active={path.startsWith(t.href)} />
        ),
      )}
      <span className="label mt-6 px-3">Help</span>
      {HELP_LINKS.map((l) => <NavLink key={l.href} href={l.href} name={l.name} active={path.startsWith(l.href)} />)}
      {user?.role === "admin" && <NavLink href="/admin" name="Team & access" active={path.startsWith("/admin")} />}

      {!user && authEnabled && (
        <Link href={`/sign-in${path && path !== "/" ? `?next=${encodeURIComponent(path)}` : ""}`}
          className="mt-6 flex min-h-11 items-center rounded-xl px-3 text-sm text-accent hover:bg-surface-2 lg:mt-auto">
          Sign in →
        </Link>
      )}
      {user && (
        <div className="mt-6 flex items-center gap-3 border-t border-border px-2 pt-4 lg:mt-auto">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{user.name.slice(0, 1).toUpperCase()}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{user.name}</div>
            <div className="truncate text-xs text-subtle">{user.role === "admin" ? "Admin" : "Member"}</div>
          </div>
          <SignOutButton className="min-h-10 rounded-lg px-2 text-xs text-muted hover:text-accent" />
        </div>
      )}
    </div>
  );
}
