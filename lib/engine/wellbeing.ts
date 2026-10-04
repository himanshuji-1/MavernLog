/** Weekly wellbeing check-in rules. Pure functions. */

export type Wellbeing = { mood: number; energy: number; motivation: number };

/** "Low" = the three scores average 2.0 or less (compared as a sum: 6 or less). */
export const LOW_WELLBEING_SUM = 6;

export function isLowWellbeing(w: Wellbeing): boolean {
  return w.mood + w.energy + w.motivation <= LOW_WELLBEING_SUM;
}

/** Both weeks must have a check-in, and both must be low. A missing week is not "low". */
export function lowTwoWeeksRunning(thisWeek: Wellbeing | null, lastWeek: Wellbeing | null): boolean {
  return thisWeek !== null && lastWeek !== null && isLowWellbeing(thisWeek) && isLowWellbeing(lastWeek);
}

export const DIET_BREAK_WELLBEING_MESSAGE =
  "You've been running on empty for two weeks. That's a signal, not a failure. " +
  "A week or two eating around maintenance usually brings energy back and makes the next stretch easier. " +
  "Your targets stay as they are, so you can pick up where you left off.";
