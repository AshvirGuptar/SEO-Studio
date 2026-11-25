import type { Metadata } from "next";
import { premiumPageAccess } from "@/lib/auth/page-guard";
import { canEdit } from "@/lib/auth/access";
import { aiEnabled } from "@/lib/ai/budget";
import { PremiumBadge } from "@/components/Crown";
import { PremiumGate } from "@/components/PremiumGate";
import { ContentClient } from "../content/ContentClient";

export const metadata: Metadata = { title: "AI Rewrite" };

/** Premium tab: the Content Optimizer's editor with the AI rewrite panel first. */
export default async function AiRewritePage() {
  const access = await premiumPageAccess();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">AI Rewrite</h1>
        <PremiumBadge />
      </div>
      <p className="mt-1 max-w-3xl text-muted">
        Paste your page&apos;s title, meta description and copy below, then let Claude suggest better versions. Every suggestion
        is scored by our own SEO and GEO checks and fact-checked, so it never adds prices, specs or claims you didn&apos;t write.
      </p>
      {!access.user ? (
        <div className="mt-6"><PremiumGate feature="AI Rewrite" path="/ai-rewrite" gate={access.gate} /></div>
      ) : !canEdit(access.user.role) ? (
        <div className="card mt-6 text-sm text-muted">Your account has read-only access, so AI Rewrite isn&apos;t available.</div>
      ) : (
        <ContentClient aiEnabled={aiEnabled()} variant="ai" />
      )}
    </div>
  );
}
