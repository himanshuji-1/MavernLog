import { describe, expect, it } from "vitest";
import { bestE1rm, epley } from "../e1rm";

describe("epley", () => {
  it("computes weight × (1 + reps / 30)", () => {
    expect(epley(100, 5)).toBeCloseTo(116.667, 2);
    expect(epley(60, 10)).toBeCloseTo(80, 5);
  });

  it("returns the weight itself for a single rep", () => {
    expect(epley(100, 1)).toBe(100);
  });

  it("rejects impossible input", () => {
    expect(() => epley(100, 0)).toThrow(RangeError);
    expect(() => epley(-5, 5)).toThrow(RangeError);
    expect(() => epley(Number.NaN, 5)).toThrow(RangeError);
  });
});

describe("bestE1rm", () => {
  it("picks the set with the highest e1RM, not the heaviest or the most reps", () => {
    const sets = [
      { weight_kg: 100, reps: 3 }, // 110
      { weight_kg: 90, reps: 8 }, // 114
      { weight_kg: 105, reps: 1 }, // 105
    ];
    expect(bestE1rm(sets)).toBeCloseTo(114, 5);
  });

  it("is null with no sets", () => {
    expect(bestE1rm([])).toBeNull();
  });
});
