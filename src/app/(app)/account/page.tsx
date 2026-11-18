import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/server";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  if (!isAuthEnabled()) redirect("/");
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/account");
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-muted">Your sign-in details.</p>
      </div>
      <div className="card text-sm">
        <dl className="grid grid-cols-[110px_1fr] gap-y-2">
          <dt className="text-muted">Name</dt><dd>{user.name}</dd>
          <dt className="text-muted">Email</dt><dd className="break-all">{user.email}</dd>
          <dt className="text-muted">Role</dt><dd>{user.role === "admin" ? "Admin" : "Member"}</dd>
        </dl>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
