import type { Metadata } from "next";
import Link from "next/link";
import { premiumPageAccess } from "@/lib/auth/page-guard";
import { listProjects } from "@/lib/db/repo";
import { aiEnabled } from "@/lib/ai/budget";
import { aiModel, webSearchMaxUses } from "@/lib/ai/config";
import { PremiumGate } from "@/components/PremiumGate";
import { PremiumBadge } from "@/components/Crown";
import { VisibilityClient } from "./VisibilityClient";

export const metadata: Metadata = { title: "AI Visibility" };

export default async function AiVisibilityPage({ searchParams }: PageProps<"/ai-visibility">) {
  const access = await premiumPageAccess();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">AI Visibility</h1>
        <PremiumBadge />
      </div>
      <p className="mt-1 max-w-3xl text-muted">
        Ask an AI assistant the questions your customers ask, with live web search, and see whether it mentions your
        brand, cites your site, and how you compare with competitors. Run it weekly to track the trend.
      </p>
      <div className="mt-6">{access.user ? <Projects initial={(await searchParams).project} /> : <PremiumGate feature="AI Visibility" path="/ai-visibility" gate={access.gate} />}</div>
    </div>
  );
}

async function Projects({ initial }: { initial: string | string[] | undefined }) {
  const projects = await listProjects();
  if (projects.length === 0) {
    return (
      <div className="card text-sm text-muted">
        AI Visibility tracks a project&apos;s brand over time. <Link href="/projects" className="text-accent hover:underline">Create a project</Link> first,
        then come back here to add the questions your customers ask.
      </div>
    );
  }
  const first = typeof initial === "string" && projects.some((p) => p.id === initial) ? initial : projects[0].id;
  return (
    <VisibilityClient
      projects={projects.map((p) => ({ id: p.id, name: p.name, domain: p.domain }))}
      initialProjectId={first}
      aiEnabled={aiEnabled()}
      model={aiModel()}
      maxSearches={webSearchMaxUses()}
    />
  );
}
