/**
 * AI cost guardrails: a daily cap per user and a monthly budget for the whole app.
 * Checked before every Claude request; actual cost is logged afterwards in ai_usage.
 */
import { aiSpendSince } from "../db/visibility-repo";
import { formatUsd, USD } from "./pricing";

export const DEFAULT_LIMITS = { dailyUserUsd: 5, monthlyUsd: 50 } as const;

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
    return { ...base, ok: false, reason: `You've reached today's AI limit (${formatUsd(limits.dailyUserMicros)}). It resets at midnight UTC.` };
  }
  return { ...base, ok: true };
}
