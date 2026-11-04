"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "./Logo";
import { HELP_LINKS, TOOLS, toolStatus } from "./nav";
import type { SessionUser } from "./session";
import { SignOutButton } from "./SignOutButton";

function NavLink({ href, name, active }: { href: string; name: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative flex items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
        active ? "bg-accent-soft font-medium text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      {active && <span className="absolute inset-y-2 left-0 hidden w-[3px] rounded-full bg-accent md:block" />}
      {name}
    </Link>
  );
}

export function Sidebar(props: { authEnabled: boolean; user: SessionUser | null }) {
  // usePathname() suspends on dynamic routes during prerender (cacheComponents), so the
  // fallback is the same sidebar without an active item.
  return (
    <Suspense fallback={<SidebarView {...props} path="" />}>
      <SidebarWithPath {...props} />
    </Suspense>
  );
}

function SidebarWithPath(props: { authEnabled: boolean; user: SessionUser | null }) {
  return <SidebarView {...props} path={usePathname()} />;
}

function SidebarView({ authEnabled, user, path }: { authEnabled: boolean; user: SessionUser | null; path: string }) {
  return (
    <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:h-screen md:w-64 md:shrink-0 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:bg-surface/60 md:px-3 md:py-6">
      <Link href="/" className="mr-4 flex items-center gap-2.5 whitespace-nowrap px-2 font-semibold tracking-tight md:mb-8 md:mr-0">
        <Logo />
        <span>SEO <span className="text-accent">Studio</span></span>
      </Link>
      <span className="label hidden px-3 md:block">Tools</span>
      {TOOLS.map((t) =>
        toolStatus(t, authEnabled) === "soon" ? (
          <span key={t.href} title={t.needsAuth ? "Available once sign-in is set up" : undefined}
            className="flex cursor-default items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-subtle">
            {t.name}
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">soon</span>
          </span>
        ) : (
          <NavLink key={t.href} href={t.href} name={t.name} active={path.startsWith(t.href)} />
        ),
      )}
      <span className="label mt-6 hidden px-3 md:block">Help</span>
      {HELP_LINKS.map((l) => <NavLink key={l.href} href={l.href} name={l.name} active={path.startsWith(l.href)} />)}
      {user?.role === "admin" && <NavLink href="/admin" name="Team & access" active={path.startsWith("/admin")} />}

      {user && (
        <div className="ml-auto flex items-center gap-3 whitespace-nowrap md:mt-auto md:ml-0 md:border-t md:border-border md:px-2 md:pt-4">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{user.name.slice(0, 1).toUpperCase()}</span>
          )}
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="truncate text-sm">{user.name}</div>
            <div className="truncate text-xs text-subtle">{user.role === "admin" ? "Admin" : "Member"}</div>
          </div>
          <SignOutButton className="text-xs text-muted hover:text-accent" />
        </div>
      )}
    </nav>
  );
}
