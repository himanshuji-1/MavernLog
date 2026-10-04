import { describe, expect, it } from "vitest";
import { onboardingSchema } from "../profile";

const valid = {
  height_cm: "178",
  start_weight_kg: "90.5",
  goal_weight_kg: "80",
  calorie_target: "2200",
  protein_target_g: "160",
  timezone: "Asia/Kolkata",
};

describe("onboardingSchema", () => {
  it("accepts valid form strings and coerces them to numbers", () => {
    const r = onboardingSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.start_weight_kg).toBe(90.5);
      expect(r.data.calorie_target).toBe(2200);
    }
  });

  it.each([
    ["height_cm", "50"],
    ["height_cm", ""],
    ["start_weight_kg", "abc"],
    ["calorie_target", "999"],
    ["calorie_target", "2200.5"],
    ["protein_target_g", "10"],
  ])("rejects %s = %j", (field, value) => {
    const r = onboardingSchema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
  });

  it("requires goal weight below current weight", () => {
    const r = onboardingSchema.safeParse({ ...valid, goal_weight_kg: "95" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["goal_weight_kg"]);
  });

  it("falls back to UTC for an unknown timezone", () => {
    const r = onboardingSchema.safeParse({ ...valid, timezone: "Mars/Olympus" });
    expect(r.success && r.data.timezone).toBe("UTC");
  });
});
