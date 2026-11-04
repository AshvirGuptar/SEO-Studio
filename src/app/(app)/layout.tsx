import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SessionProvider, type SessionUser } from "@/components/session";
import { AccessGate } from "@/components/AccessGate";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/server";

/**
 * App shell. The frame is static; anything that reads the signed-in user (cookies) sits inside
 * <Suspense> as Next 16's cacheComponents requires.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const authEnabled = isAuthEnabled();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Suspense fallback={<Sidebar authEnabled={authEnabled} user={null} />}>
        <SidebarWithUser authEnabled={authEnabled} />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-10">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface/60" />}>
          <Gate authEnabled={authEnabled}>{children}</Gate>
        </Suspense>
      </main>
    </div>
  );
}

async function loadUser(authEnabled: boolean): Promise<{ user: SessionUser | null; status: string | null; email: string | null }> {
  if (!authEnabled) return { user: null, status: null, email: null };
  const u = await getCurrentUser();
  if (!u) return { user: null, status: null, email: null };
  return { user: { id: u.id, name: u.name, email: u.email, image: u.image, role: u.role }, status: u.status, email: u.email };
}

async function SidebarWithUser({ authEnabled }: { authEnabled: boolean }) {
  const { user, status } = await loadUser(authEnabled);
  return <Sidebar authEnabled={authEnabled} user={status === "active" ? user : null} />;
}

async function Gate({ authEnabled, children }: { authEnabled: boolean; children: React.ReactNode }) {
  const { user, status, email } = await loadUser(authEnabled);
  // Signed in but not (yet) allowed in: show the waiting / disabled screen instead of the app.
  if (authEnabled && email && status !== "active") {
    return <AccessGate status={status === "disabled" ? "disabled" : "pending"} email={email} />;
  }
  return <SessionProvider value={{ authEnabled, user }}>{children}</SessionProvider>;
}
