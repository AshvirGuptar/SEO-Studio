import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { isAuthEnabled, PASSWORD_LIMITS } from "@/lib/auth/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

/** Landing page for emailed reset links (Better Auth redirects here with ?token= or ?error=). */
export default function ResetPasswordPage(props: PageProps<"/reset-password">) {
  return (
    <Suspense fallback={null}>
      <Reset {...props} />
    </Suspense>
  );
}

async function Reset({ searchParams }: PageProps<"/reset-password">) {
  if (!isAuthEnabled()) redirect("/");
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && token.length > 0 && !error;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="card w-full max-w-sm">
        <div className="flex justify-center"><Logo size={44} /></div>
        <h1 className="mt-4 text-center text-xl font-semibold tracking-tight">Choose a new password</h1>
        <div className="mt-6">
          {valid ? (
            <ResetPasswordForm token={token} minPassword={PASSWORD_LIMITS.min} maxPassword={PASSWORD_LIMITS.max} />
          ) : (
            <div className="space-y-4 text-sm">
              <p className="rounded-lg bg-fail/10 p-3 text-fail" role="alert">This reset link is invalid or has expired. Links work once, for a limited time.</p>
              <Link href="/sign-in" className="btn w-full">Back to sign in</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
