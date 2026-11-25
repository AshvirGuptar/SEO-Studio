import type { Metadata } from "next";
import { premiumPageAccess } from "@/lib/auth/page-guard";
import { canEdit } from "@/lib/auth/access";
import { aiEnabled } from "@/lib/ai/budget";
import { PremiumBadge } from "@/components/Crown";
import { GeoOptimizationClient } from "./GeoOptimizationClient";
import type { AiAccess } from "./ui";

export const metadata: Metadata = { title: "GEO Optimization" };

/**
 * Premium tab, but rule-based first: the schema builder and AI access kit work for everyone; only the
 * Claude-powered rewrite and FAQ generator need an approved account (and an API key).
 */
export default async function GeoOptimizationPage() {
  const access = await premiumPageAccess();
  const ai: AiAccess = access.gate
    ? access.gate
    : !canEdit(access.user.role) ? "read-only" : aiEnabled() ? "ready" : "no-key";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">GEO Optimization</h1>
        <PremiumBadge />
      </div>
      <p className="mt-1 max-w-3xl text-muted">
        Fix what the GEO score flags, so AI answer engines can find, quote and cite your pages: rewrite copy answer-first, add FAQ
        and schema markup, and set AI-crawler rules and llms.txt. Every AI result is re-scored and fact-checked before you use it.
        The schema builder and AI access kit are free.
      </p>
      <GeoOptimizationClient ai={ai} />
    </div>
  );
}
