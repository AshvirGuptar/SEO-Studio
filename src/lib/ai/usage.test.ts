import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../db/test-db";

vi.mock("server-only", () => ({}));

beforeEach(async () => {
  await createTestDb();
  vi.unstubAllEnvs();
  vi.stubEnv("AI_MONTHLY_BUDGET_USD", "10");
});

describe("monthly budget alerts", () => {
  it("fires each level once per month as spending grows", async () => {
    const { recordAiUsage, sendBudgetAlerts } = await import("./usage");
    const now = new Date();
    const spend = (usd: number) => recordAiUsage({ userId: null, projectId: null, feature: "test", model: "claude-opus-5-5", usage: { inputTokens: 0, outputTokens: 0 }, costMicros: usd * 1_000_000 });
    await spend(4);
    expect(await sendBudgetAlerts(now)).toEqual([]);
    await spend(1.5); // 5.5 of 10: 50% fired by recordAiUsage
    expect(await sendBudgetAlerts(now)).toEqual([]); // already sent
    await spend(3); // 8.5: 80%
    await spend(2); // 10.5: 100%
    expect(await sendBudgetAlerts(now)).toEqual([]);
    const { getDb } = await import("../db");
    const { aiAlert } = await import("../db/schema");
    const ids = (await getDb().select().from(aiAlert)).map((r) => r.id.split(":")[1]).sort();
    expect(ids).toEqual(["100", "50", "80"]);
  });
});
