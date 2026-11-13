/**
 * Runs AI Visibility prompts one at a time. Each call answers ONE prompt so no request runs long
 * (serverless timeouts), the browser can show live progress, and the cron job can pick up where it
 * left off. Shared by the "next prompt" route and the scheduled cron route.
 */
import "server-only";
import { analyzeAnswer, estimateRunCost, summarizeRun, type BrandHit } from "../seo/visibility";
import {
  claimNextResult, completeResult, createRun, failResult, getRun, logAiUsage, settleRun,
  type RunWithResults,
} from "../db/visibility-repo";
import type { VisibilityRun, VisibilitySetup } from "../db/schema";
import { checkBudget } from "./budget";
import { askWithWebSearch, AskError, describeAiError } from "./visibility";
import { DEFAULT_MODEL } from "./pricing";

export const FEATURE = "ai-visibility";

export type StepOutcome =
  | { kind: "answered" | "failed"; remaining: number; status: VisibilityRun["status"] }
  | { kind: "idle"; remaining: number; status: VisibilityRun["status"] }
  | { kind: "blocked"; reason: string };

/** Starts a run from a project's setup (budget-checked against the high estimate). */
export async function startRun(
  setup: VisibilitySetup, trigger: "manual" | "scheduled", userId: string | null,
): Promise<{ run: VisibilityRun; error?: undefined } | { run?: undefined; error: string }> {
  const estimate = estimateRunCost(setup.prompts.length);
  const budget = await checkBudget(userId, estimate.highMicros);
  if (!budget.ok) return { error: budget.reason! };
  const run = await createRun({
    projectId: setup.projectId, prompts: setup.prompts, brands: setup.brands, model: DEFAULT_MODEL, trigger,
    estimatedCostMicros: estimate.highMicros,
  }, userId);
  return { run };
}

/** Answers the next pending prompt of a run. `userId` pays (null = scheduled/system). */
export async function processNextPrompt(runId: string, userId: string | null): Promise<StepOutcome> {
  const run = await getRun(runId);
  if (!run || run.status !== "running") return { kind: "idle", remaining: 0, status: run?.status ?? "done" };

  const perPrompt = estimateRunCost(1).highMicros;
  const budget = await checkBudget(userId, perPrompt);
  if (!budget.ok) return { kind: "blocked", reason: budget.reason! };

  const item = await claimNextResult(runId);
  if (!item) return { kind: "idle", ...(await settleRun(runId)) };

  let kind: "answered" | "failed" = "answered";
  try {
    const a = await askWithWebSearch(item.prompt);
    const hits = analyzeAnswer(a, run.brands);
    await completeResult(item.id, { answer: a.answer, citations: a.citations, sources: a.sources, hits, model: a.model, costMicros: a.costMicros });
    await logAiUsage({ userId, projectId: run.projectId, feature: FEATURE, model: a.model, usage: a.usage, costMicros: a.costMicros });
  } catch (e) {
    kind = "failed";
    const cost = e instanceof AskError ? e.costMicros : 0;
    await failResult(item.id, describeAiError(e), cost);
    if (e instanceof AskError) {
      await logAiUsage({ userId, projectId: run.projectId, feature: FEATURE, model: e.model, usage: e.usage, costMicros: cost });
    } else {
      console.error("[ai-visibility]", e);
    }
  }
  return { kind, ...(await settleRun(runId)) };
}

/** Run + per-prompt results + roll-up, as JSON for the client. */
export function serializeRun(run: RunWithResults) {
  const done = run.results.filter((r) => r.status === "done" && r.hits);
  const summary = summarizeRun(done.map((r) => ({ hits: r.hits as BrandHit[] })), run.brands);
  return {
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    createdBy: run.createdBy,
    model: run.model,
    brands: run.brands,
    promptCount: run.promptCount,
    estimatedCostMicros: run.estimatedCostMicros,
    costMicros: run.results.reduce((s, r) => s + r.costMicros, 0),
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    summary,
    results: run.results.map((r) => ({
      id: r.id, position: r.position, prompt: r.prompt, status: r.status, answer: r.answer, error: r.error,
      citations: r.citations ?? [], sources: r.sources ?? [], hits: r.hits ?? [], model: r.model, costMicros: r.costMicros,
    })),
  };
}

export type SerializedRun = ReturnType<typeof serializeRun>;
