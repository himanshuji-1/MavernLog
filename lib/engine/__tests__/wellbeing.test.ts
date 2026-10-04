import { describe, expect, it } from "vitest";
import { DIET_BREAK_WELLBEING_MESSAGE, isLowWellbeing, lowTwoWeeksRunning } from "../wellbeing";

const w = (mood: number, energy: number, motivation: number) => ({ mood, energy, motivation });

describe("isLowWellbeing", () => {
  it("is low when the three scores average 2.0 or less", () => {
    expect(isLowWellbeing(w(2, 2, 2))).toBe(true); // exactly 2.0
    expect(isLowWellbeing(w(1, 2, 3))).toBe(true);
    expect(isLowWellbeing(w(1, 1, 1))).toBe(true);
  });

  it("is not low above 2.0", () => {
    expect(isLowWellbeing(w(2, 2, 3))).toBe(false); // 2.33
    expect(isLowWellbeing(w(3, 3, 3))).toBe(false);
  });
});

describe("lowTwoWeeksRunning", () => {
  it("low one week only → no", () => {
    expect(lowTwoWeeksRunning(w(1, 1, 1), w(4, 4, 4))).toBe(false);
    expect(lowTwoWeeksRunning(w(4, 4, 4), w(1, 1, 1))).toBe(false);
  });

  it("low two weeks running → yes", () => {
    expect(lowTwoWeeksRunning(w(2, 2, 2), w(1, 2, 2))).toBe(true);
  });

  it("a missing check-in is not 'low'", () => {
    expect(lowTwoWeeksRunning(w(1, 1, 1), null)).toBe(false);
    expect(lowTwoWeeksRunning(null, w(1, 1, 1))).toBe(false);
    expect(lowTwoWeeksRunning(null, null)).toBe(false);
  });
});

describe("diet break message", () => {
  it("is kind: no blame, mentions it's a signal and not a failure", () => {
    expect(DIET_BREAK_WELLBEING_MESSAGE).toContain("signal, not a failure");
    expect(DIET_BREAK_WELLBEING_MESSAGE).not.toMatch(/\b(should|must|lazy|fail(ed)? to)\b/i);
  });
});
