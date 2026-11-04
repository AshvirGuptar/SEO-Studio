import { Logo } from "./Logo";
import { BRAND } from "@/lib/brand";
import { SignOutButton } from "./SignOutButton";

export function AccessGate({ status, email }: { status: "pending" | "disabled"; email: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background px-4">
      <div className="card w-full max-w-md text-center">
        <div className="flex justify-center"><Logo size={40} /></div>
        {status === "pending" ? (
          <>
            <h1 className="mt-4 text-xl font-semibold">Access requested</h1>
            <p className="mt-2 text-sm text-muted">
              You&apos;re signed in as <b className="text-foreground">{email}</b>. An admin needs to approve your access.
              You&apos;ll get in automatically next time you sign in after they do.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-semibold">Account disabled</h1>
            <p className="mt-2 text-sm text-muted">
              <b className="text-foreground">{email}</b> no longer has access to {BRAND.name}. Contact an admin if this is a mistake.
            </p>
          </>
        )}
        <div className="mt-6 flex justify-center"><SignOutButton /></div>
      </div>
    </div>
  );
}
