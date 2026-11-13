import { timingSafeEqual } from "node:crypto";
import { aiEnabled } from "@/lib/ai/budget";
import { processNextPrompt, startRun } from "@/lib/ai/visibility-runner";
import { listRunningRuns, projectsDueForScheduledRun } from "@/lib/db/visibility-repo";
import { databaseUrl } from "@/lib/db";

/**
 * Vercel Cron (vercel.json, daily): starts weekly runs that are due, then answers pending prompts
 * until the time budget is spent. Anything left over continues on the next call (or when someone
 * opens the run in the browser). Protected by CRON_SECRET, which Vercel sends as a Bearer token.
 */
export const maxDuration = 300;
const TIME_BUDGET_MS = 230_000;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (!aiEnabled() || !databaseUrl()) return Response.json({ skipped: "AI or database not configured." });

  const started: string[] = [];
  for (const setup of await projectsDueForScheduledRun()) {
    const r = await startRun(setup, "scheduled", null);
    if (r.run) started.push(r.run.id);
    else return Response.json({ started, stopped: r.error });
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  let answered = 0;
  let blocked: string | null = null;
  for (const run of await listRunningRuns()) {
    if (run.trigger !== "scheduled") continue; // manual runs are driven by the person who started them
    while (Date.now() < deadline) {
      const step = await processNextPrompt(run.id, null);
      if (step.kind === "blocked") { blocked = step.reason; break; }
      if (step.kind === "idle") break;
      answered++;
      if (step.remaining === 0) break;
    }
    if (blocked || Date.now() >= deadline) break;
  }
  return Response.json({ started, answered, blocked });
}
