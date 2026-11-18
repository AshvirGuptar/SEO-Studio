import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { getCurrentUser, isAuthEnabled, isGoogleEnabled, PASSWORD_LIMITS } from "@/lib/auth/server";
import { GoogleButton } from "./GoogleButton";
import { EmailAuthForm } from "./EmailAuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={null}>
      <SignIn {...props} />
    </Suspense>
  );
}

async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const { next, error, mode } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (!isAuthEnabled()) redirect("/");
  if (await getCurrentUser()) redirect(nextPath);
  const google = isGoogleEnabled();

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="card w-full max-w-sm">
        <div className="flex justify-center"><Logo size={44} /></div>
        <h1 className="mt-4 text-center text-xl font-semibold tracking-tight">SEO &amp; GEO <span className="text-accent">Studio</span></h1>
        <p className="mt-1 text-center text-sm text-muted">New accounts get access once an admin approves them (invited people get in right away).</p>
        {error && <p className="mt-4 rounded-lg bg-fail/10 p-2 text-center text-sm text-fail">Sign-in failed. Please try again.</p>}
        <div className="mt-6">
          <EmailAuthForm next={nextPath} initialMode={mode === "signup" ? "signup" : "signin"} minPassword={PASSWORD_LIMITS.min} maxPassword={PASSWORD_LIMITS.max} />
        </div>
        {google && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
            </div>
            <GoogleButton next={nextPath} />
          </>
        )}
      </div>
    </main>
  );
}
