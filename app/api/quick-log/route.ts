import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { callGemini, isGeminiConfigured } from "@/lib/ai/gemini";
import { consumeQuota } from "@/lib/ai/quota";
import {
  MAX_TEXT_LENGTH,
  QUICK_LOG_SYSTEM_PROMPT,
  buildConfirmDraft,
  buildQuickLogPrompt,
  geminiResponseSchema,
  parseJsonReply,
} from "@/lib/ai/quicklog";
import { createClient, getUserId } from "@/lib/supabase/server";
import { resolveToday } from "@/lib/today";
import { loadExercises } from "@/lib/workout-data";

const bodySchema = z.object({
  text: z.string().trim().min(1, "Say or type something first.").max(MAX_TEXT_LENGTH, "That's a bit long. Try one sentence."),
  as_of: z.string().max(10).nullish(),
});

const fail = (status: number, code: string, message: string, headers?: HeadersInit) =>
  NextResponse.json({ error: { code, message } }, { status, headers });

/** Turns one sentence into a DRAFT. Saves nothing: the user confirms first. */
export async function POST(request: NextRequest) {
  // A JSON content type can't be sent by a cross-site form, which closes off CSRF.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail(415, "bad_request", "Unsupported request.");
  }
  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return fail(413, "bad_request", "That's too long.");
  }

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) return fail(401, "unauthorized", "Please sign in again.");

  if (!isGeminiConfigured()) {
    return fail(503, "not_configured", "Quick log isn't set up yet.");
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "bad_request", body.error.issues[0]?.message ?? "Invalid request.");

  const { data: profile } = await supabase.from("profiles").select("timezone").maybeSingle();
  if (!profile) return fail(403, "no_profile", "Finish onboarding first.");

  const quota = await consumeQuota(supabase, userId, "quick_log");
  if (!quota.allowed) {
    const minutes = Math.max(1, Math.ceil(quota.retryAfterSeconds / 60));
    return fail(429, "rate_limited", `You've used quick log a lot. Try again in ${minutes} min.`, {
      "Retry-After": String(quota.retryAfterSeconds),
    });
  }

  const today = resolveToday(profile.timezone, body.data.as_of);
  const exercises = (await loadExercises(supabase)).filter((e) => !e.archived);

  const reply = await callGemini({
    system: QUICK_LOG_SYSTEM_PROMPT,
    prompt: buildQuickLogPrompt({ text: body.data.text, today, exerciseNames: exercises.map((e) => e.name) }),
    jsonSchema: geminiResponseSchema(),
  });
  if (!reply.ok) {
    const busy = reply.code === "timeout" || reply.code === "network" || reply.status === 503 || reply.status === 429;
    return fail(502, reply.code, busy ? "The assistant is busy right now. Try again in a minute, or use the manual log below." : "The assistant couldn't handle that. Try the manual log below.");
  }

  const result = buildConfirmDraft(parseJsonReply(reply.text), {
    today,
    exercises: exercises.map((e) => ({ id: e.id, name: e.name })),
  });
  if (!result.ok) return fail(502, "unreadable", "I couldn't read that. Try saying it a different way.");

  return NextResponse.json({ draft: result.draft, isEmpty: result.isEmpty });
}
