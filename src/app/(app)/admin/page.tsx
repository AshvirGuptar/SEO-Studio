import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/page-guard";
import { isAuthEnabled, isGoogleEnabled } from "@/lib/auth/server";
import { accessConfigFromEnv } from "@/lib/auth/access";
import { listAdminActions, listAllMemberships, listInvites, listProjects, listUsers } from "@/lib/db/repo";
import { listPendingResets } from "@/lib/db/reset-repo";
import { SetupNotice } from "@/components/SetupNotice";
import { AdminClient } from "./AdminClient";
import { EmailCheck } from "./EmailCheck";
import { emailSenderAddress } from "@/lib/email/send";
import { aiEnabled, aiLimits, ALERT_THRESHOLDS } from "@/lib/ai/budget";
import { aiSpendSince } from "@/lib/db/visibility-repo";
import { formatUsd } from "@/lib/ai/pricing";

export const metadata: Metadata = { title: "Team & access" };

export default async function AdminPage() {
  if (!isAuthEnabled()) return <SetupNotice feature="Team & access" signInOnly />;
  const user = await requirePageUser();
  if (!user) return <SetupNotice feature="Team & access" signInOnly />;
  if (user.role !== "admin") notFound();
  const [users, invites, resets, projects, memberships, activity] = await Promise.all([
    listUsers(), listInvites(), listPendingResets(), listProjects(), listAllMemberships(), listAdminActions(),
  ]);
  const byUser: Record<string, string[]> = {};
  for (const m of memberships) (byUser[m.userId] ??= []).push(m.projectId);
  const cfg = accessConfigFromEnv();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Team & access</h1>
      <p className="mt-1 text-muted">
        Approve access requests, invite people (inside or outside the company) and manage roles.
        {cfg.autoApproveDomains.length > 0 && isGoogleEnabled() && <> Google sign-ins at <b className="text-foreground">{cfg.autoApproveDomains.join(", ")}</b> are approved automatically (email sign-ups still need approval, since the address isn&apos;t verified).</>}
      </p>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <EmailCheck sender={emailSenderAddress()} />
        <AiBudgetCard />
      </div>
      <AdminClient
        currentUserId={user.id}
        envAdmins={cfg.adminEmails}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, image: u.image, role: u.role, status: u.status, createdAt: u.createdAt.toISOString() }))}
        resets={resets.map((r) => ({ id: r.id, userId: r.userId, name: r.name, email: r.email, code: r.code, createdAt: r.createdAt.toISOString() }))}
        invites={invites.map((i) => ({ email: i.email, role: i.role, projectId: i.projectId, createdAt: i.createdAt.toISOString() }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        memberships={byUser}
        activity={activity.map((a) => ({ id: a.id, actorEmail: a.actorEmail, action: a.action, target: a.target, createdAt: a.createdAt.toISOString() }))}
      />
    </div>
  );
}

/** This month's AI spending against the cap; admins get emailed at each alert level. */
async function AiBudgetCard() {
  const now = new Date();
  const spent = await aiSpendSince(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), "all");
  const { monthlyMicros, dailyUserMicros } = aiLimits();
  const pct = monthlyMicros ? Math.min(100, Math.round((spent / monthlyMicros) * 100)) : 0;
  return (
    <div className="card text-sm">
      <h2 className="font-medium">AI budget this month</h2>
      <p className="mt-1 text-muted">
        {aiEnabled() ? <>{formatUsd(spent)} of {formatUsd(monthlyMicros)} used ({pct}%). Each person can spend up to {formatUsd(dailyUserMicros)} a day.</> : "AI is off: ANTHROPIC_API_KEY isn't set."}
      </p>
      {aiEnabled() && (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${pct}% of the monthly AI budget used`}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--fail)" : pct >= 80 ? "var(--warn)" : "var(--pass)" }} />
          </div>
          <p className="mt-2 text-xs text-subtle">Admins are emailed at {ALERT_THRESHOLDS.join("%, ")}%. AI features pause at 100% until next month.</p>
        </>
      )}
    </div>
  );
}
