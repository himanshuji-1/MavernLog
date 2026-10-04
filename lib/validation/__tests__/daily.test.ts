import { describe, expect, it } from "vitest";
import { dailyLogSchema, wellbeingSchema } from "../daily";

const base = { log_date: "2026-10-04" };

describe("dailyLogSchema", () => {
  it("accepts a full log and coerces form strings", () => {
    const r = dailyLogSchema.safeParse({
      ...base,
      bodyweight_kg: "84.2",
      steps: "9000",
      sleep_hours: "7.5",
      diet_followed: "mostly",
      hunger: "3",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({
        bodyweight_kg: 84.2,
        steps: 9000,
        sleep_hours: 7.5,
        diet_followed: "mostly",
        hunger: 3,
      });
    }
  });

  it("treats empty fields as null, so a cleared field is saved as cleared", () => {
    const r = dailyLogSchema.safeParse({ ...base, bodyweight_kg: "84", steps: "", hunger: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.steps).toBeNull();
      expect(r.data.hunger).toBeNull();
    }
  });

  it("requires at least one value", () => {
    const r = dailyLogSchema.safeParse({ ...base, bodyweight_kg: "", steps: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["form"]);
  });

  it.each([
    ["hunger", "7"],
    ["hunger", "0"],
    ["hunger", "2.5"],
    ["bodyweight_kg", "0"],
    ["bodyweight_kg", "abc"],
    ["steps", "-5"],
    ["steps", "1.5"],
    ["sleep_hours", "25"],
    ["diet_followed", "sometimes"],
  ])("rejects %s = %j", (field, value) => {
    // A valid steps value is included so only the field under test can fail.
    const input = { ...base, steps: "100", [field]: value };
    expect(dailyLogSchema.safeParse(input).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(dailyLogSchema.safeParse({ log_date: "yesterday", steps: "100" }).success).toBe(false);
  });
});

describe("wellbeingSchema", () => {
  it("accepts 1–5 for each score", () => {
    expect(wellbeingSchema.safeParse({ mood: "3", energy: "1", motivation: "5" }).success).toBe(true);
  });

  it.each([
    { mood: "0", energy: "3", motivation: "3" },
    { mood: "3", energy: "6", motivation: "3" },
    { mood: "3", energy: "3" },
    { mood: "3", energy: "3", motivation: "x" },
  ])("rejects %j", (v) => {
    expect(wellbeingSchema.safeParse(v).success).toBe(false);
  });
});
