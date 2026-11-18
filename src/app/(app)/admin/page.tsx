import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page-guard";
import { isAuthEnabled, isGoogleEnabled } from "@/lib/auth/server";
import { accessConfigFromEnv } from "@/lib/auth/access";
import { listInvites, listUsers } from "@/lib/db/repo";
import { SetupNotice } from "@/components/SetupNotice";
import { AdminClient } from "./AdminClient";

export const metadata: Metadata = { title: "Team & access" };

export default async function AdminPage() {
  if (!isAuthEnabled()) return <SetupNotice feature="Team & access" signInOnly />;
  const user = await requirePageUser();
  if (!user) return <SetupNotice feature="Team & access" signInOnly />;
  if (user.role !== "admin") notFound();
  const [users, invites] = await Promise.all([listUsers(), listInvites()]);
  const cfg = accessConfigFromEnv();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Team & access</h1>
      <p className="mt-1 text-muted">
        Approve access requests, invite people (inside or outside the company) and manage roles.
        {cfg.autoApproveDomains.length > 0 && isGoogleEnabled() && <> Google sign-ins at <b className="text-foreground">{cfg.autoApproveDomains.join(", ")}</b> are approved automatically (email sign-ups still need approval, since the address isn&apos;t verified).</>}
      </p>
      <AdminClient
        currentUserId={user.id}
        envAdmins={cfg.adminEmails}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, image: u.image, role: u.role, status: u.status, createdAt: u.createdAt.toISOString() }))}
        invites={invites.map((i) => ({ email: i.email, role: i.role, createdAt: i.createdAt.toISOString() }))}
      />
    </div>
  );
}
