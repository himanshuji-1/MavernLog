import type { ReviewOutcome } from "@/lib/engine/weeklyReview";

/** Label + badge colours for each review outcome. */
export const OUTCOME_DISPLAY: Record<ReviewOutcome, { label: string; badge: string }> = {
  insufficient_data: {
    label: "Not enough data",
    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  on_track: {
    label: "On track",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  simplify: {
    label: "Keep it simple",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
  stall_watch: {
    label: "Watching a flat week",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  ladder_step: {
    label: "Plan stepped up",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  diet_break: {
    label: "Diet break",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
  too_fast: {
    label: "Losing too fast",
    badge: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300",
  },
  raise_calories: {
    label: "Calories raised",
    badge: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300",
  },
};
