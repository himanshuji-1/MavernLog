import { describe, expect, it } from "vitest";
import type { ReviewRow } from "@/lib/reviews";
import { buildExplainFacts, buildExplainPrompt, cleanExplanation, extractNumbers, usesOnlyKnownNumbers } from "../explain";
import { LIMITS, checkQuota } from "../quota";

const review: ReviewRow = {
  week_start: "2026-09-21",
  outcome: "ladder_step",
  message: "Two flat weeks in a row, so it's time for a small step (1 of 4). Daily step target is now 9,500.",
  avg_weight_kg: 88.6,
  prev_avg_weight_kg: 88.64,
  loss_rate_pct: 0.05,
  adherence_pct: 92.9,
  ladder_rung: 1,
  calorie_target_before: 2200,
  calorie_target_after: 2200,
  step_target_before: null,
  step_target_after: 9500,
};

describe("extractNumbers", () => {
  it("finds integers, decimals and comma-separated thousands", () => {
    expect(extractNumbers("2,200 kcal, 0.55% and 88.6 kg in 7 days")).toEqual([2200, 0.55, 88.6, 7]);
    expect(extractNumbers("no digits here")).toEqual([]);
  });
});

describe("usesOnlyKnownNumbers: the explanation can't invent numbers", () => {
  const facts = buildExplainFacts(review, { weigh_ins: 7 });

  it("builds facts from the stored review", () => {
    const text = facts.join("\n");
    expect(text).toContain("Average weight this week: 88.6 kg");
    expect(text).toContain("Weekly loss rate: 0.05%");
    expect(text).toContain("Daily step target is now 9,500");
    expect(text).toContain("Calorie target stays at 2,200");
    expect(buildExplainPrompt(facts)).toContain("- Weekly loss rate");
  });

  it("accepts an answer that repeats numbers from the facts", () => {
    const answer = "Your weight stayed around 88.6 kg, so your step target is now 9,500 a day and calories stay at 2,200.";
    expect(usesOnlyKnownNumbers(answer, facts)).toEqual({ ok: true, unknown: [] });
  });

  it("accepts words and small rule counts like '7-day' and 'two weeks'", () => {
    expect(usesOnlyKnownNumbers("Two flat weeks, so a small step: your 7-day average hasn't moved.", facts).ok).toBe(true);
  });

  it("rejects a number Gemini calculated", () => {
    const r = usesOnlyKnownNumbers("You've only lost 0.04 kg, so try 10,000 steps.", facts);
    expect(r.ok).toBe(false);
    expect(r.unknown).toEqual([0.04, 10000]);
  });

  it("rejects a rounded version of a real number", () => {
    expect(usesOnlyKnownNumbers("You're down about 89 kg.", facts).ok).toBe(false);
  });
});

describe("cleanExplanation", () => {
  it("strips markdown characters and tidies whitespace", () => {
    expect(cleanExplanation("**Good** week. `Steps` up.\n\n# Next step\n\n\n\nKeep going.  ")).toBe(
      "Good week. Steps up.\n\nNext step\n\nKeep going.",
    );
  });
});

describe("rate limiting", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const calls = (n: number, ago: (i: number) => number) => Array.from({ length: n }, (_, i) => minutesAgo(ago(i)));

  it("allows a user under the limit", () => {
    expect(checkQuota(calls(LIMITS.perHour - 1, (i) => i), now)).toEqual({ allowed: true });
    expect(checkQuota([], now)).toEqual({ allowed: true });
  });

  it("blocks at the hourly limit and says how long to wait", () => {
    // 20 calls in the last hour; the oldest was 50 minutes ago → free in 10 minutes.
    const r = checkQuota(calls(LIMITS.perHour, (i) => 31 + i), now);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.retryAfterSeconds).toBe(Math.ceil((60 - 50) * 60));
  });

  it("calls older than an hour don't count towards the hourly limit", () => {
    expect(checkQuota(calls(LIMITS.perHour, () => 61), now)).toEqual({ allowed: true });
  });

  it("blocks at the daily limit even when the last hour is quiet", () => {
    const r = checkQuota(calls(LIMITS.perDay, (i) => 61 + i * 10), now);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("calls older than a day don't count", () => {
    expect(checkQuota(calls(LIMITS.perDay, () => 25 * 60), now)).toEqual({ allowed: true });
  });
});
