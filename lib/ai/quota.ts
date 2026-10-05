/** Per-user rate limiting for the Gemini endpoints. */

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AiKind = "quick_log" | "explain";

export const LIMITS = { perHour: 20, perDay: 100 };

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type QuotaDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Pure rule: given when this user's recent calls happened, may they make
 * another one right now? If not, how long until they can.
 */
export function checkQuota(callTimes: Date[], now: Date, limits = LIMITS): QuotaDecision {
  const ms = callTimes.map((t) => t.getTime()).sort((a, b) => b - a); // newest first

  const waitFor = (windowMs: number, max: number) => {
    const inWindow = ms.filter((t) => now.getTime() - t < windowMs);
    if (inWindow.length < max) return 0;
    // The oldest call that still counts has to age out of the window.
    const blocking = inWindow[max - 1];
    return Math.ceil((blocking + windowMs - now.getTime()) / 1000);
  };

  const retry = Math.max(waitFor(HOUR_MS, limits.perHour), waitFor(DAY_MS, limits.perDay));
  return retry > 0 ? { allowed: false, retryAfterSeconds: retry } : { allowed: true };
}

/** Checks the limit and, if allowed, records this call. */
export async function consumeQuota(
  supabase: Supabase,
  userId: string,
  kind: AiKind,
  now = new Date(),
): Promise<QuotaDecision> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const { data } = await supabase
    .from("ai_usage")
    .select("created_at")
    .eq("kind", kind)
    .gte("created_at", since)
    .limit(1000);

  const decision = checkQuota((data ?? []).map((r) => new Date(r.created_at)), now);
  if (!decision.allowed) return decision;

  await supabase.from("ai_usage").insert({ user_id: userId, kind });
  // Housekeeping: nothing older than two days is ever read.
  await supabase
    .from("ai_usage")
    .delete()
    .lt("created_at", new Date(now.getTime() - 2 * DAY_MS).toISOString());
  return decision;
}
