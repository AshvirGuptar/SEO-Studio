/**
 * Records one Claude request's usage and sends monthly budget alerts (server-only). Every AI
 * feature calls recordAiUsage() after a request, so spending is logged and alerts fire in one place.
 */
import "server-only";
import { getDb } from "../db";
import { aiAlert } from "../db/schema";
import { aiSpendSince, logAiUsage } from "../db/visibility-repo";
import { accessConfigFromEnv } from "../auth/access";
import { isEmailEnabled, sendEmail } from "../email/send";
import { BRAND } from "../brand";
import { aiLimits, crossedThresholds } from "./budget";
import { formatUsd, type TokenUsage } from "./pricing";

export async function recordAiUsage(input: {
  userId: string | null; projectId: string | null; feature: string; model: string; usage: TokenUsage; costMicros: number;
}): Promise<void> {
  await logAiUsage(input);
  await sendBudgetAlerts().catch((e) => console.error("[ai-budget]", e));
}

/** Emails admins once per month per level (50/80/100%) when spending crosses it. */
export async function sendBudgetAlerts(now = new Date()): Promise<number[]> {
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const { monthlyMicros } = aiLimits();
  const spent = await aiSpendSince(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), "all");
  const fired: number[] = [];
  for (const t of crossedThresholds(spent, monthlyMicros)) {
    const [row] = await getDb().insert(aiAlert).values({ id: `${month}:${t}` }).onConflictDoNothing().returning();
    if (!row) continue; // already sent this month
    fired.push(t);
    const text = `${BRAND.name} has used ${formatUsd(spent)} of its ${formatUsd(monthlyMicros)} monthly AI budget (${t}%).`
      + (t >= 100 ? " AI features are paused until next month or until an admin raises AI_MONTHLY_BUDGET_USD." : "");
    console.warn(`[ai-budget] ${text}`);
    const admins = accessConfigFromEnv().adminEmails;
    if (isEmailEnabled() && admins.length) {
      await sendEmail(admins.join(", "), {
        subject: `${BRAND.name}: ${t}% of the monthly AI budget used`,
        text,
        html: `<p>${text}</p>`,
      }).catch((e) => console.error("[ai-budget] alert email failed", e));
    }
  }
  return fired;
}
