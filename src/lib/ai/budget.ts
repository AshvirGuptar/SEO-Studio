/**
 * AI cost guardrails: a daily cap per user and a monthly budget for the whole app.
 * Checked before every Claude request; actual cost is logged afterwards in ai_usage.
 */
import { aiSpendSince } from "../db/visibility-repo";
import { OPEN_MODE_USER } from "../db/repo";
import { formatUsd, USD } from "./pricing";

/** Sized for the $10 starter credits; raise with AI_DAILY_USER_LIMIT_USD / AI_MONTHLY_BUDGET_USD. */
export const DEFAULT_LIMITS = { dailyUserUsd: 2, monthlyUsd: 10 } as const;

/** ANTHROPIC_API_KEY set → AI features are on. Without it they stay visible but disabled. */
export function aiEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}

export function aiLimits(env: Record<string, string | undefined> = process.env): { dailyUserMicros: number; monthlyMicros: number } {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && v?.trim() ? n : d;
  };
  return {
    dailyUserMicros: Math.round(num(env.AI_DAILY_USER_LIMIT_USD, DEFAULT_LIMITS.dailyUserUsd) * USD),
    monthlyMicros: Math.round(num(env.AI_MONTHLY_BUDGET_USD, DEFAULT_LIMITS.monthlyUsd) * USD),
  };
}

export interface BudgetStatus {
  ok: boolean;
  reason?: string;
  spentTodayMicros: number;
  spentMonthMicros: number;
  dailyUserMicros: number;
  monthlyMicros: number;
}

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const startOfUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/**
 * Can `userId` (null = scheduled/system work) spend roughly `nextMicros` more right now?
 * The daily cap applies to people; the monthly budget applies to everything.
 */
export async function checkBudget(userId: string | null, nextMicros = 0, now = new Date()): Promise<BudgetStatus> {
  const limits = aiLimits();
  const [spentTodayMicros, spentMonthMicros] = await Promise.all([
    userId ? aiSpendSince(startOfUtcDay(now), { userId }) : Promise.resolve(0),
    aiSpendSince(startOfUtcMonth(now), "all"),
  ]);
  const base = { spentTodayMicros, spentMonthMicros, ...limits };
  if (spentMonthMicros + nextMicros > limits.monthlyMicros) {
    return { ...base, ok: false, reason: `The monthly AI budget (${formatUsd(limits.monthlyMicros)}) is used up. An admin can raise AI_MONTHLY_BUDGET_USD.` };
  }
  if (userId && spentTodayMicros + nextMicros > limits.dailyUserMicros) {
    const who = userId === OPEN_MODE_USER.id ? "The team's shared daily AI limit" : "Your daily AI limit";
    return { ...base, ok: false, reason: `${who} (${formatUsd(limits.dailyUserMicros)}) is used up. It resets at midnight UTC.` };
  }
  return { ...base, ok: true };
}

/** Monthly budget alert levels (percent of AI_MONTHLY_BUDGET_USD). */
export const ALERT_THRESHOLDS = [50, 80, 100] as const;

/** Which alert levels `spent` has reached (pure). */
export function crossedThresholds(spentMicros: number, budgetMicros: number): number[] {
  if (budgetMicros <= 0) return [];
  return ALERT_THRESHOLDS.filter((t) => spentMicros >= (budgetMicros * t) / 100);
}
