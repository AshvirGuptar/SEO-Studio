import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SessionProvider, type SessionUser } from "@/components/session";
import { AccessGate } from "@/components/AccessGate";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/server";
import { dataEnabled, openModeEnabled, publicToolsEnabled } from "@/lib/auth/enabled";
import { openModeUser } from "@/lib/auth/open-mode";

/**
 * App shell. The frame is static; anything that reads the signed-in user (cookies) sits inside
 * <Suspense> as Next 16's cacheComponents requires.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const authEnabled = isAuthEnabled();
  const hasData = dataEnabled();
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Suspense fallback={<Sidebar authEnabled={authEnabled} dataEnabled={hasData} user={null} />}>
        <SidebarWithUser authEnabled={authEnabled} dataEnabled={hasData} />
      </Suspense>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 md:py-8 lg:px-8 lg:py-10">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface/60" />}>
          <Gate authEnabled={authEnabled}>{children}</Gate>
        </Suspense>
      </main>
    </div>
  );
}

async function loadUser(authEnabled: boolean): Promise<{ user: SessionUser | null; status: string | null; email: string | null }> {
  if (!authEnabled) {
    // Open mode: everyone acts as the shared Team user (no sign-in, no account menu).
    if (!openModeEnabled()) return { user: null, status: null, email: null };
    const u = await openModeUser();
    return { user: { id: u.id, name: u.name, email: u.email, image: null, role: u.role }, status: "active", email: null };
  }
  const u = await getCurrentUser();
  if (!u) return { user: null, status: null, email: null };
  return { user: { id: u.id, name: u.name, email: u.email, image: u.image, role: u.role }, status: u.status, email: u.email };
}

async function SidebarWithUser({ authEnabled, dataEnabled }: { authEnabled: boolean; dataEnabled: boolean }) {
  // The account menu (and Team & access) only make sense with real sign-in.
  const { user, status } = authEnabled ? await loadUser(true) : { user: null, status: null };
  return <Sidebar authEnabled={authEnabled} dataEnabled={dataEnabled} user={status === "active" ? user : null} />;
}

async function Gate({ authEnabled, children }: { authEnabled: boolean; children: React.ReactNode }) {
  const { user, status, email } = await loadUser(authEnabled);
  // Signed in but not (yet) allowed in: show the waiting / disabled screen instead of the app.
  if (authEnabled && email && status !== "active") {
    return <AccessGate status={status === "disabled" ? "disabled" : "pending"} email={email} />;
  }
  // The proxy only checks that a session cookie exists. If that session was revoked (password reset,
  // expired), send the visitor to sign in instead of showing a half-signed-out app.
  if (authEnabled && !user && !publicToolsEnabled()) redirect("/sign-in");
  return <SessionProvider value={{ authEnabled, user }}>{children}</SessionProvider>;
}
