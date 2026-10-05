import { describe, expect, it } from "vitest";
import { assembleTranscript, speechErrorMessage } from "../speech";

const r = (transcript: string, isFinal = true) => ({ isFinal, 0: { transcript } });

describe("assembleTranscript", () => {
  it("joins phrases from continuous mode with spaces", () => {
    expect(assembleTranscript([r("weighed 84.2 this morning"), r(" slept 7 hours")])).toBe(
      "weighed 84.2 this morning slept 7 hours",
    );
  });

  it("includes the phrase still being spoken (interim)", () => {
    expect(assembleTranscript([r("weighed 84.2"), r("slept seven", false)])).toBe("weighed 84.2 slept seven");
  });

  it("collapses Android's cumulative repeats", () => {
    expect(assembleTranscript([r("weighed"), r("weighed 84"), r("weighed 84.2 this morning")])).toBe(
      "weighed 84.2 this morning",
    );
  });

  it("drops a shorter repeat of the phrase it already has", () => {
    expect(assembleTranscript([r("bench 3 sets of 5"), r("bench 3 sets")])).toBe("bench 3 sets of 5");
  });

  it("ignores empty results and tidies whitespace", () => {
    expect(assembleTranscript([r(""), r("  hunger   3  "), r("   ")])).toBe("hunger 3");
    expect(assembleTranscript([])).toBe("");
  });
});

describe("speechErrorMessage", () => {
  it("says nothing when we stopped it ourselves", () => {
    expect(speechErrorMessage("aborted")).toBe("");
  });

  it("explains blocked microphone access", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/blocked/);
    expect(speechErrorMessage("service-not-allowed")).toMatch(/blocked/);
  });

  it("names Brave when its speech service is unavailable", () => {
    expect(speechErrorMessage("network", true)).toMatch(/Brave/);
    expect(speechErrorMessage("network", false)).not.toMatch(/Brave/);
  });

  it("always offers the keyboard mic as a fallback for real failures", () => {
    for (const code of ["not-allowed", "network", "language-not-supported", "something-new"]) {
      expect(speechErrorMessage(code)).toMatch(/keyboard/);
    }
  });

  it("handles silence", () => {
    expect(speechErrorMessage("no-speech")).toMatch(/didn't hear/);
  });
});
