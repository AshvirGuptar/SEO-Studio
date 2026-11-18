import Link from "next/link";
import { Crown } from "./Crown";
import { SetupNotice } from "./SetupNotice";
import type { PremiumAccess } from "@/lib/auth/page-guard";

/** Shown instead of a premium tool when the visitor isn't an approved, signed-in user. */
/** `premium={false}`: an account-only feature (e.g. saved projects) that doesn't use paid AI. */
export function PremiumGate({ feature, path, gate, premium = true }: { feature: string; path: string; gate: NonNullable<PremiumAccess["gate"]>; premium?: boolean }) {
  if (gate === "setup") return <SetupNotice feature={feature} />;
  const next = encodeURIComponent(path);
  return (
    <div className={`card max-w-xl ${premium ? "border-premium/30" : ""}`}>
      {premium ? (
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-premium">
          <Crown size={16} /> Premium feature
        </div>
      ) : (
        <div className="label mb-0">Needs an account</div>
      )}
      {gate === "signin" && (
        <>
          <h2 className="mt-3 text-lg font-medium">{feature} is only for approved users</h2>
          <p className="mt-1 text-sm text-muted">
            {premium ? "It runs on paid AI, so it needs an approved account." : "Saved work belongs to an account."} Please sign in, or
            create an account to request access. All the free tools work without one.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/sign-in?next=${next}`} className="btn">Sign in</Link>
            <Link href={`/sign-in?mode=signup&next=${next}`} className="btn-ghost">Request access</Link>
          </div>
        </>
      )}
      {gate === "pending" && (
        <>
          <h2 className="mt-3 text-lg font-medium">Your access request is waiting for approval</h2>
          <p className="mt-1 text-sm text-muted">
            An admin needs to approve your account before you can use {feature}. Once they do, refresh this page.
            The free tools work in the meantime.
          </p>
          <div className="mt-5"><a href="" className="btn">Refresh</a></div>
        </>
      )}
      {gate === "disabled" && (
        <>
          <h2 className="mt-3 text-lg font-medium">Your account doesn&apos;t have access</h2>
          <p className="mt-1 text-sm text-muted">Contact an admin if this is a mistake.</p>
        </>
      )}
    </div>
  );
}
