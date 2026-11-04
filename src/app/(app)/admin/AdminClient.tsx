"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Time } from "@/components/Time";

type Role = "admin" | "member";
type Status = "pending" | "active" | "disabled";
interface Row { id: string; name: string; email: string; image: string | null; role: Role; status: Status; createdAt: string }
interface InviteRow { email: string; role: Role; createdAt: string }

const STATUS_STYLE: Record<Status, string> = {
  active: "bg-pass/15 text-pass",
  pending: "bg-warn/15 text-warn",
  disabled: "bg-surface-2 text-subtle",
};

export function AdminClient({ users, invites, currentUserId, envAdmins }: { users: Row[]; invites: InviteRow[]; currentUserId: string; envAdmins: string[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  async function call(key: string, url: string, init: RequestInit) {
    setBusy(key);
    setError(null);
    const r = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
    setBusy(null);
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }
  const patch = (u: Row, body: Partial<Pick<Row, "role" | "status">>) => call(u.id, `/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify(body) });

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (await call("invite", "/api/admin/invites", { method: "POST", body: JSON.stringify({ email, role }) })) setEmail("");
  }

  return (
    <div className="mt-6 space-y-6">
      {error && <p className="rounded-lg bg-fail/10 p-3 text-sm text-fail">{error}</p>}

      {pending.length > 0 && (
        <div className="card border-warn/30">
          <h2 className="font-medium">Waiting for approval ({pending.length})</h2>
          <ul className="mt-3 divide-y divide-border">
            {pending.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <Person u={u} />
                <span className="text-xs text-subtle">requested <Time iso={u.createdAt} relative /></span>
                <div className="flex gap-2">
                  <button className="btn" disabled={busy === u.id} onClick={() => patch(u, { status: "active" })}>Approve</button>
                  <button className="btn-ghost" disabled={busy === u.id} onClick={() => patch(u, { status: "disabled" })}>Deny</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={invite} className="card flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="inv-email">Invite by email</label>
          <input id="inv-email" type="email" className="input" placeholder="name@company.com or freelancer@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="inv-role">Role</label>
          <select id="inv-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button className="btn" disabled={busy === "invite"}>Invite</button>
        <p className="w-full text-xs text-subtle">They sign in with Google using that email address and get in straight away. No email is sent, so let them know.</p>
      </form>

      {invites.length > 0 && (
        <div className="card">
          <h2 className="font-medium">Pending invites ({invites.length})</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {invites.map((i) => (
              <li key={i.email} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="flex-1 break-all">{i.email}</span>
                <span className="text-xs text-muted">{i.role === "admin" ? "Admin" : "Member"}</span>
                <span className="text-xs text-subtle">invited <Time iso={i.createdAt} relative /></span>
                <button className="text-xs text-subtle hover:text-fail" onClick={() => call(i.email, `/api/admin/invites?email=${encodeURIComponent(i.email)}`, { method: "DELETE" })}>Revoke</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <h2 className="p-4 font-medium">People ({others.length})</h2>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-y border-border text-left text-[11px] uppercase tracking-wide text-subtle">
            <tr><th className="p-3">Person</th><th className="p-3">Status</th><th className="p-3">Role</th><th className="p-3">Joined</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {others.map((u) => {
              const locked = u.id === currentUserId || envAdmins.includes(u.email.toLowerCase());
              return (
                <tr key={u.id}>
                  <td className="p-3"><Person u={u} /></td>
                  <td className="p-3"><span className={`rounded-md px-1.5 py-0.5 text-xs ${STATUS_STYLE[u.status]}`}>{u.status}</span></td>
                  <td className="p-3">
                    {locked ? (
                      <span className="text-xs text-muted" title={u.id === currentUserId ? "You can't change your own role" : "Set by ADMIN_EMAILS in Vercel"}>
                        {u.role === "admin" ? "Admin" : "Member"} {u.id !== currentUserId && "· env"}
                      </span>
                    ) : (
                      <select className="input w-32 py-1" value={u.role} disabled={busy === u.id} onChange={(e) => patch(u, { role: e.target.value as Role })} aria-label={`Role for ${u.email}`}>
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted"><Time iso={u.createdAt} relative /></td>
                  <td className="p-3 text-right">
                    {!locked && (u.status === "active" ? (
                      <button className="text-xs text-subtle hover:text-fail" onClick={() => confirm(`Remove ${u.email}'s access?`) && patch(u, { status: "disabled" })}>Disable</button>
                    ) : (
                      <button className="text-xs text-subtle hover:text-pass" onClick={() => patch(u, { status: "active" })}>Re-enable</button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Person({ u }: { u: Row }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {u.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={u.image} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{u.name.slice(0, 1).toUpperCase()}</span>
      )}
      <div className="min-w-0">
        <div className="truncate">{u.name}</div>
        <div className="truncate text-xs text-subtle">{u.email}</div>
      </div>
    </div>
  );
}
