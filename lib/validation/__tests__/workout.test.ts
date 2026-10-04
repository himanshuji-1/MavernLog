import { describe, expect, it } from "vitest";
import { exerciseSchema, setSchema } from "../workout";

const ids = {
  session_id: "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b",
  exercise_id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
};
const validSet = { ...ids, set_number: "1", weight_kg: "62.5", reps: "5", rir: "2" };

describe("setSchema", () => {
  it("accepts a valid set and coerces form strings", () => {
    const r = setSchema.safeParse(validSet);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ set_number: 1, weight_kg: 62.5, reps: 5, rir: 2 });
  });

  it("accepts RIR 0 and weight 0 (bodyweight work)", () => {
    expect(setSchema.safeParse({ ...validSet, rir: "0", weight_kg: "0" }).success).toBe(true);
  });

  it("an empty field is an error, never silently 0", () => {
    for (const field of ["weight_kg", "reps", "rir"]) {
      const r = setSchema.safeParse({ ...validSet, [field]: "" });
      expect(r.success, field).toBe(false);
    }
  });

  it.each([
    ["rir", "6"],
    ["rir", "-1"],
    ["rir", "1.5"],
    ["reps", "0"],
    ["reps", "2.5"],
    ["weight_kg", "-5"],
    ["weight_kg", "abc"],
    ["weight_kg", "1001"],
    ["session_id", "not-a-uuid"],
  ])("rejects %s = %j", (field, value) => {
    expect(setSchema.safeParse({ ...validSet, [field]: value }).success).toBe(false);
  });
});

describe("exerciseSchema", () => {
  const valid = { name: "  Incline Press ", body_region: "upper", target_sets: "3", target_reps: "8" };

  it("accepts and trims", () => {
    const r = exerciseSchema.safeParse(valid);
    expect(r.success && r.data.name).toBe("Incline Press");
  });

  it.each([
    ["name", ""],
    ["name", "   "],
    ["body_region", "core"],
    ["target_sets", "0"],
    ["target_sets", "11"],
    ["target_reps", "31"],
    ["target_reps", "5.5"],
  ])("rejects %s = %j", (field, value) => {
    expect(exerciseSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
});
