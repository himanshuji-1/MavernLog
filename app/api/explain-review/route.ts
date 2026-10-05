import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  EXPLAIN_SYSTEM_PROMPT,
  buildExplainFacts,
  buildExplainPrompt,
  cleanExplanation,
  usesOnlyKnownNumbers,
} from "@/lib/ai/explain";
import { callGemini, isGeminiConfigured } from "@/lib/ai/gemini";
import { consumeQuota } from "@/lib/ai/quota";
import { REVIEW_COLUMNS, normalizeReview } from "@/lib/reviews";
import { createClient, getUserId } from "@/lib/supabase/server";
import { isoDate } from "@/lib/validation/shared";

const bodySchema = z.object({ week_start: isoDate });

const fail = (status: number, code: string, message: string, headers?: HeadersInit) =>
  NextResponse.json({ error: { code, message } }, { status, headers });

/** Rephrases a review the engine already decided. Never changes or adds numbers. */
export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail(415, "bad_request", "Unsupported request.");
  }

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return fail(401, "unauthorized", "Please sign in again.");

  if (!isGeminiConfigured()) return fail(503, "not_configured", "Explanations aren't set up yet.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "bad_request", "Invalid request.");

  // RLS means this can only ever find the signed-in user's own review.
  const { data: row } = await supabase
    .from("weekly_reviews")
    .select(`${REVIEW_COLUMNS}, inputs`)
    .eq("week_start", body.data.week_start)
    .maybeSingle();
  if (!row) return fail(404, "not_found", "Review not found.");

  const quota = await consumeQuota(supabase, userId, "explain");
  if (!quota.allowed) {
    const minutes = Math.max(1, Math.ceil(quota.retryAfterSeconds / 60));
    return fail(429, "rate_limited", `Try again in ${minutes} min.`, { "Retry-After": String(quota.retryAfterSeconds) });
  }

  const facts = buildExplainFacts(normalizeReview(row), (row.inputs ?? {}) as Record<string, unknown>);
  const reply = await callGemini({
    system: EXPLAIN_SYSTEM_PROMPT,
    prompt: buildExplainPrompt(facts),
    maxOutputTokens: 600,
  });
  if (!reply.ok) {
    const busy = reply.status === 503 || reply.status === 429 || reply.code === "timeout";
    return fail(502, reply.code, busy ? "The assistant is busy right now. Try again in a minute." : "Couldn't get an explanation right now.");
  }

  const text = cleanExplanation(reply.text);
  const check = usesOnlyKnownNumbers(text, facts);
  if (!check.ok) {
    // Gemini introduced a number that isn't in the review. Don't show it.
    console.warn("Explanation rejected: introduced numbers", check.unknown);
    return fail(422, "unverified", "I couldn't explain this one reliably. The message above is accurate.");
  }

  return NextResponse.json({ text });
}
