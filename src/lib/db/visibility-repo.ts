/** Database reads/writes for AI Visibility and AI usage logging. Route handlers stay thin. */
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  aiUsage, project, visibilityResult, visibilityRun, visibilitySetup,
  type VisibilityResult, type VisibilityRun, type VisibilitySetup,
} from "./schema";
import type { BrandHit, Source, TrackedBrand } from "../seo/visibility";
import type { TokenUsage } from "../ai/pricing";

const newId = () => crypto.randomUUID();

/** A "running" row older than this is assumed abandoned (closed tab, crashed function) and retried. */
export const STALE_RUNNING_MS = 5 * 60 * 1000;
/** Scheduled runs repeat this often. */
export const SCHEDULE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------- setup ----------
export async function getVisibilitySetup(projectId: string): Promise<VisibilitySetup | undefined> {
  const [s] = await getDb().select().from(visibilitySetup).where(eq(visibilitySetup.projectId, projectId));
  return s;
}

export async function saveVisibilitySetup(
  projectId: string,
  input: { prompts: string[]; brands: TrackedBrand[]; schedule: "off" | "weekly" },
  userId: string | null,
): Promise<VisibilitySetup> {
  const values = { ...input, updatedBy: userId, updatedAt: new Date() };
  const [s] = await getDb()
    .insert(visibilitySetup)
    .values({ projectId, ...values })
    .onConflictDoUpdate({ target: visibilitySetup.projectId, set: values })
    .returning();
  return s;
}

// ---------- runs ----------
export interface RunWithResults extends VisibilityRun {
  results: VisibilityResult[];
}

export async function createRun(input: {
  projectId: string;
  prompts: string[];
  brands: TrackedBrand[];
  model: string;
  trigger: "manual" | "scheduled";
  estimatedCostMicros: number;
}, createdBy: string | null): Promise<VisibilityRun> {
  const db = getDb();
  const [run] = await db
    .insert(visibilityRun)
    .values({
      id: newId(), projectId: input.projectId, model: input.model, brands: input.brands, trigger: input.trigger,
      promptCount: input.prompts.length, estimatedCostMicros: input.estimatedCostMicros, createdBy,
    })
    .returning();
  await db.insert(visibilityResult).values(
    input.prompts.map((prompt, position) => ({ id: newId(), runId: run.id, position, prompt })),
  );
  await db.update(project).set({ updatedAt: new Date() }).where(eq(project.id, input.projectId));
  return run;
}

export async function getRun(id: string): Promise<VisibilityRun | undefined> {
  const [r] = await getDb().select().from(visibilityRun).where(eq(visibilityRun.id, id));
  return r;
}

export async function getRunWithResults(id: string): Promise<RunWithResults | undefined> {
  const run = await getRun(id);
  if (!run) return undefined;
  const results = await getDb().select().from(visibilityResult).where(eq(visibilityResult.runId, id)).orderBy(asc(visibilityResult.position));
  return { ...run, results };
}

/** Newest first, with their results (for summaries and the trend chart). */
export async function listRunsWithResults(projectId: string, limit = 20): Promise<RunWithResults[]> {
  const db = getDb();
  const runs = await db.select().from(visibilityRun).where(eq(visibilityRun.projectId, projectId)).orderBy(desc(visibilityRun.createdAt)).limit(limit);
  if (runs.length === 0) return [];
  const results = await db
    .select()
    .from(visibilityResult)
    .where(inArray(visibilityResult.runId, runs.map((r) => r.id)))
    .orderBy(asc(visibilityResult.position));
  return runs.map((r) => ({ ...r, results: results.filter((x) => x.runId === r.id) }));
}

export async function getActiveRun(projectId: string): Promise<VisibilityRun | undefined> {
  const [r] = await getDb()
    .select()
    .from(visibilityRun)
    .where(and(eq(visibilityRun.projectId, projectId), eq(visibilityRun.status, "running")))
    .orderBy(desc(visibilityRun.createdAt))
    .limit(1);
  return r;
}

/**
 * Atomically takes the next prompt to process (pending, or abandoned while running) and marks it
 * running, so two workers (browser + cron) never answer the same prompt twice.
 */
export async function claimNextResult(runId: string): Promise<VisibilityResult | undefined> {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS);
  const db = getDb();
  const next = db
    .select({ id: visibilityResult.id })
    .from(visibilityResult)
    .where(and(
      eq(visibilityResult.runId, runId),
      sql`(${visibilityResult.status} = 'pending' or (${visibilityResult.status} = 'running' and ${visibilityResult.startedAt} < ${staleBefore}))`,
    ))
    .orderBy(asc(visibilityResult.position))
    .limit(1)
    .for("update", { skipLocked: true });
  const [claimed] = await db
    .update(visibilityResult)
    .set({ status: "running", startedAt: new Date() })
    .where(inArray(visibilityResult.id, next))
    .returning();
  return claimed;
}

export async function completeResult(id: string, data: {
  answer: string; citations: Source[]; sources: Source[]; hits: BrandHit[]; model: string; costMicros: number;
}): Promise<VisibilityResult> {
  const [r] = await getDb()
    .update(visibilityResult)
    .set({ ...data, status: "done", error: null, completedAt: new Date() })
    .where(eq(visibilityResult.id, id))
    .returning();
  return r;
}

export async function failResult(id: string, error: string, costMicros = 0): Promise<VisibilityResult> {
  const [r] = await getDb()
    .update(visibilityResult)
    .set({ status: "error", error: error.slice(0, 500), costMicros, completedAt: new Date() })
    .where(eq(visibilityResult.id, id))
    .returning();
  return r;
}

/** Counts prompts still to do; marks the run done when none are left. */
export async function settleRun(runId: string): Promise<{ remaining: number; status: VisibilityRun["status"] }> {
  const db = getDb();
  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(visibilityResult)
    .where(and(eq(visibilityResult.runId, runId), inArray(visibilityResult.status, ["pending", "running"])));
  const run = await getRun(runId);
  if (!run) return { remaining: 0, status: "done" };
  if (Number(remaining) === 0 && run.status === "running") {
    await db.update(visibilityRun).set({ status: "done", completedAt: new Date() }).where(eq(visibilityRun.id, runId));
    return { remaining: 0, status: "done" };
  }
  return { remaining: Number(remaining), status: run.status };
}

/** Stops a run: prompts not yet started are skipped; answers already saved are kept. */
export async function stopRun(runId: string): Promise<void> {
  const db = getDb();
  await db
    .update(visibilityResult)
    .set({ status: "skipped", completedAt: new Date() })
    .where(and(eq(visibilityResult.runId, runId), eq(visibilityResult.status, "pending")));
  await db.update(visibilityRun).set({ status: "stopped", completedAt: new Date() }).where(and(eq(visibilityRun.id, runId), eq(visibilityRun.status, "running")));
}

export async function deleteRun(runId: string): Promise<void> {
  await getDb().delete(visibilityRun).where(eq(visibilityRun.id, runId));
}

// ---------- scheduling ----------
/** Projects with a weekly schedule, no active run, and no run in the last week. */
export async function projectsDueForScheduledRun(now = new Date()): Promise<VisibilitySetup[]> {
  const db = getDb();
  const setups = await db.select().from(visibilitySetup).where(eq(visibilitySetup.schedule, "weekly"));
  const due: VisibilitySetup[] = [];
  for (const s of setups) {
    const [last] = await db
      .select({ createdAt: visibilityRun.createdAt, status: visibilityRun.status })
      .from(visibilityRun)
      .where(eq(visibilityRun.projectId, s.projectId))
      .orderBy(desc(visibilityRun.createdAt))
      .limit(1);
    if (!last || (last.status !== "running" && +now - +last.createdAt >= SCHEDULE_INTERVAL_MS)) due.push(s);
  }
  return due;
}

/** Runs that still have prompts to answer, oldest first. */
export async function listRunningRuns(): Promise<VisibilityRun[]> {
  return getDb().select().from(visibilityRun).where(eq(visibilityRun.status, "running")).orderBy(asc(visibilityRun.createdAt));
}

// ---------- AI usage & budgets ----------
export async function logAiUsage(input: {
  userId: string | null; projectId: string | null; feature: string; model: string; usage: TokenUsage; costMicros: number;
}): Promise<void> {
  const u = input.usage;
  await getDb().insert(aiUsage).values({
    id: newId(), userId: input.userId, projectId: input.projectId, feature: input.feature, model: input.model,
    inputTokens: u.inputTokens, outputTokens: u.outputTokens, cacheReadTokens: u.cacheReadTokens ?? 0,
    cacheWriteTokens: u.cacheWriteTokens ?? 0, webSearches: u.webSearches ?? 0, costMicros: input.costMicros,
  });
}

/** Spend in micro-dollars since `since`, for one user (or system runs when userId is null) or for everyone. */
export async function aiSpendSince(since: Date, scope: { userId: string | null } | "all"): Promise<number> {
  const conds = [gte(aiUsage.createdAt, since)];
  if (scope !== "all") conds.push(scope.userId ? eq(aiUsage.userId, scope.userId) : isNull(aiUsage.userId));
  const [{ total }] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)::int` })
    .from(aiUsage)
    .where(and(...conds));
  return Number(total);
}
