import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "./test-db";
import { getDb } from "./index";
import { user, visibilityResult, visibilityRun } from "./schema";
import { createProject } from "./repo";
import * as v from "./visibility-repo";
import { checkBudget } from "../ai/budget";
import { eq } from "drizzle-orm";
import type { TrackedBrand } from "../seo/visibility";

const brands: TrackedBrand[] = [{ name: "Example PC", aliases: [], domains: ["example-pc.com"], own: true }];
let projectId = "";

beforeEach(async () => {
  await createTestDb();
  vi.unstubAllEnvs();
  await getDb().insert(user).values({ id: "u1", name: "U", email: "u@x.com", status: "active" });
  projectId = (await createProject({ name: "Example PC", domain: "example-pc.com" }, "u1")).id;
});

const newRun = (prompts = ["a", "b"]) =>
  v.createRun({ projectId, prompts, brands, model: "claude-opus-5-5", trigger: "manual", estimatedCostMicros: 1 }, "u1");

describe("setup", () => {
  it("saves and updates a project's setup", async () => {
    await v.saveVisibilitySetup(projectId, { prompts: ["a"], brands, schedule: "off" }, "u1");
    await v.saveVisibilitySetup(projectId, { prompts: ["a", "b"], brands, schedule: "weekly" }, "u1");
    expect(await v.getVisibilitySetup(projectId)).toMatchObject({ prompts: ["a", "b"], schedule: "weekly" });
  });
});

describe("runs", () => {
  it("processes prompts in order, once each, then marks the run done", async () => {
    const run = await newRun();
    const first = await v.claimNextResult(run.id);
    const second = await v.claimNextResult(run.id);
    expect([first?.prompt, second?.prompt]).toEqual(["a", "b"]);
    expect(await v.claimNextResult(run.id)).toBeUndefined();
    expect(await v.settleRun(run.id)).toEqual({ remaining: 2, status: "running" });

    await v.completeResult(first!.id, { answer: "x", citations: [], sources: [], hits: [], model: "m", costMicros: 5 });
    await v.failResult(second!.id, "boom");
    expect(await v.settleRun(run.id)).toEqual({ remaining: 0, status: "done" });
    const full = await v.getRunWithResults(run.id);
    expect(full?.results.map((r) => r.status)).toEqual(["done", "error"]);
    expect(await v.getActiveRun(projectId)).toBeUndefined();
  });

  it("retries a prompt abandoned mid-run", async () => {
    const run = await newRun(["a"]);
    const r = await v.claimNextResult(run.id);
    await getDb().update(visibilityResult).set({ startedAt: new Date(Date.now() - v.STALE_RUNNING_MS - 1000) }).where(eq(visibilityResult.id, r!.id));
    expect((await v.claimNextResult(run.id))?.id).toBe(r!.id);
  });

  it("stopping skips what's left and keeps answers", async () => {
    const run = await newRun(["a", "b", "c"]);
    const r = await v.claimNextResult(run.id);
    await v.completeResult(r!.id, { answer: "x", citations: [], sources: [], hits: [], model: "m", costMicros: 0 });
    await v.stopRun(run.id);
    const full = await v.getRunWithResults(run.id);
    expect(full?.status).toBe("stopped");
    expect(full?.results.map((x) => x.status)).toEqual(["done", "skipped", "skipped"]);
    expect(await v.claimNextResult(run.id)).toBeUndefined();
  });

  it("lists runs newest first with results", async () => {
    await newRun(["a"]);
    await newRun(["b", "c"]);
    const runs = await v.listRunsWithResults(projectId);
    expect(runs.map((r) => r.results.length)).toEqual([2, 1]);
  });
});

describe("scheduling", () => {
  it("is due when weekly and the last run is a week old", async () => {
    await v.saveVisibilitySetup(projectId, { prompts: ["a"], brands, schedule: "weekly" }, "u1");
    expect(await v.projectsDueForScheduledRun()).toHaveLength(1);
    const run = await newRun(["a"]);
    expect(await v.projectsDueForScheduledRun()).toHaveLength(0); // running
    await v.stopRun(run.id);
    expect(await v.projectsDueForScheduledRun()).toHaveLength(0); // too recent
    await getDb().update(visibilityRun).set({ createdAt: new Date(Date.now() - v.SCHEDULE_INTERVAL_MS) }).where(eq(visibilityRun.id, run.id));
    expect(await v.projectsDueForScheduledRun()).toHaveLength(1);
  });
});

describe("budget", () => {
  it("enforces the daily per-user cap and the monthly budget", async () => {
    vi.stubEnv("AI_DAILY_USER_LIMIT_USD", "1");
    vi.stubEnv("AI_MONTHLY_BUDGET_USD", "2");
    const log = (userId: string | null, costMicros: number) =>
      v.logAiUsage({ userId, projectId, feature: "ai-visibility", model: "claude-opus-5-5", usage: { inputTokens: 1, outputTokens: 1 }, costMicros });
    await log("u1", 900_000);
    expect((await checkBudget("u1", 50_000)).ok).toBe(true);
    expect(await checkBudget("u1", 200_000)).toMatchObject({ ok: false, spentTodayMicros: 900_000 });
    await log(null, 1_000_000); // scheduled run: counts toward the month, not the user's day
    expect((await checkBudget(null, 50_000)).ok).toBe(true);
    expect((await checkBudget(null, 200_000)).reason).toMatch(/monthly/);
  });
});
