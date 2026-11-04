import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth/server";
import { GoogleButton } from "./GoogleButton";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={null}>
      <SignIn {...props} />
    </Suspense>
  );
}

async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (!isAuthEnabled()) redirect("/");
  if (await getCurrentUser()) redirect(nextPath);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm text-center">
        <div className="flex justify-center"><Logo size={44} /></div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Sign in to SEO <span className="text-accent">Studio</span></h1>
        <p className="mt-2 text-sm text-muted">Use your Google account. New users need an invite or admin approval.</p>
        {error && <p className="mt-4 rounded-lg bg-fail/10 p-2 text-sm text-fail">Sign-in failed. Please try again.</p>}
        <div className="mt-6"><GoogleButton next={nextPath} /></div>
      </div>
    </main>
  );
}
