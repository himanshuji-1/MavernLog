/**
 * Eight weeks of fake but realistic data, built to exercise every branch of the
 * weekly review. Pure and deterministic: same `today` in → same data out.
 *
 *   week 1  baseline (nothing to compare against yet)
 *   week 2  on track
 *   week 3  low adherence               → simplify
 *   week 4  on track
 *   week 5  flat weight                 → watching
 *   week 6  flat weight again           → ladder rung 1
 *   week 7  on track, wellbeing low
 *   week 8  on track, wellbeing low 2nd → diet break (safety wins)
 *
 * Workouts follow the engine's own targets (an A/B split, 3 a week), with a
 * scripted pattern of hits, "too easy" sessions and misses. Bench Press gets
 * one double miss, so a deload shows up in the history.
 */

import { addDays, weekStart as mondayOf } from "@/lib/dates";
import { sessionsForExercise, type HistoryRow } from "@/lib/engine/history";
import { nextTarget, type BodyRegion } from "@/lib/engine/progression";
import type { DailyEntry, DietFollowed, WellbeingEntry } from "@/lib/engine/weeklyReview";

export const SEED_START_WEIGHT_KG = 90;
export const SEED_CALORIE_TARGET = 2200;
export const SEED_STEP_TARGET: number | null = null;

export type SeedExercise = {
  name: string;
  body_region: BodyRegion;
  target_sets: number;
  target_reps: number;
};

export type SeedDailyLog = DailyEntry & { hunger: number };

export type SeedSet = { exercise: string; set_number: number; weight_kg: number; reps: number; rir: number };

export type SeedSession = {
  performed_on: string;
  started_at: string;
  finished_at: string;
  sets: SeedSet[];
};

export type Scenario = {
  /** Mondays of the eight finished weeks, oldest first. */
  weeks: string[];
  dailyLogs: SeedDailyLog[];
  wellbeing: WellbeingEntry[];
  sessions: SeedSession[];
};

/** Small seeded PRNG so "random" noise is the same on every run. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Weekly loss rate (%) going into each week; week 1 has nothing before it.
// Weeks 5–6 are the stall; the rest sit comfortably inside the 0.3–0.7% zone.
const WEEKLY_LOSS_PCT = [0, 0.55, 0.55, 0.55, 0.05, 0.03, 0.55, 0.55, 0.5];

const Y: DietFollowed = "yes";
const M: DietFollowed = "mostly";
const N: DietFollowed = "no";
const DIET_BY_WEEK: (DietFollowed | null)[][] = [
  [Y, Y, M, Y, Y, Y, Y],
  [Y, Y, Y, M, Y, Y, M],
  [Y, M, N, N, null, M, Y], // the low-adherence week: 43%
  [Y, Y, Y, Y, M, Y, Y],
  [Y, Y, Y, Y, Y, M, Y],
  [Y, Y, Y, M, Y, Y, Y],
  [Y, M, Y, Y, Y, Y, M],
  [Y, Y, Y, Y, M, Y, Y],
  [Y, Y, Y, Y, Y, Y, Y], // the unfinished current week
];

// Days (0 = Monday) with no weigh-in, per week.
const MISSED_WEIGH_INS: Record<number, number[]> = { 1: [3], 4: [6], 6: [2], 7: [5] };

const WELLBEING: [number, number, number][] = [
  [3, 3, 4],
  [4, 3, 4],
  [3, 3, 3],
  [4, 4, 3],
  [3, 3, 3],
  [3, 2, 3],
  [2, 2, 2], // low
  [2, 1, 2], // low again → diet break
];

// What happened in each session of an exercise: H = hit, S = too easy (RIR 3), M = missed a rep.
const SESSION_PATTERNS: Record<string, string> = {
  Squat: "HHHSHHHMHHSHHH",
  "Bench Press": "HHSHHHMMHHSHHH", // the double miss, then a deload
  "Barbell Row": "HHHHSHHHHMHHHH",
  Deadlift: "HHSHHHHSHHHHHH",
  "Overhead Press": "HSHHHHMHHSHHHH",
  "Lat Pulldown": "HHHHSHHHMHHHHH",
};

const START_WEIGHTS: Record<string, number> = {
  Squat: 80,
  "Bench Press": 60,
  "Barbell Row": 50,
  Deadlift: 100,
  "Overhead Press": 40,
  "Lat Pulldown": 50,
};

const WORKOUT_A = ["Squat", "Bench Press", "Barbell Row"];
const WORKOUT_B = ["Deadlift", "Overhead Press", "Lat Pulldown"];
const WORKOUT_DAYS = [0, 2, 4]; // Mon, Wed, Fri

function buildDailyLogs(today: string, firstWeek: string, rand: () => number): SeedDailyLog[] {
  const logs: SeedDailyLog[] = [];
  const weekMeans: number[] = [];
  let mean = SEED_START_WEIGHT_KG;
  for (let w = 0; w < WEEKLY_LOSS_PCT.length; w++) {
    mean = mean * (1 - WEEKLY_LOSS_PCT[w] / 100);
    weekMeans.push(mean);
  }

  for (let w = 0; w < WEEKLY_LOSS_PCT.length; w++) {
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstWeek, w * 7 + d);
      if (date >= today) continue; // only the past, never today or later

      const noise = rand() * 0.5 - 0.25; // ±0.25 kg day-to-day
      const skipped = MISSED_WEIGH_INS[w]?.includes(d) ?? false;
      logs.push({
        log_date: date,
        bodyweight_kg: skipped ? null : Math.round((weekMeans[w] + noise) * 10) / 10,
        steps: Math.round((7500 + (rand() * 3000 - 1500)) / 100) * 100,
        sleep_hours: 6.5 + Math.floor(rand() * 4) * 0.5, // 6.5–8
        diet_followed: DIET_BY_WEEK[w][d],
        hunger: 2 + Math.floor(rand() * 3), // 2–4
      });
    }
  }
  return logs;
}

function buildSessions(today: string, firstWeek: string, exercises: SeedExercise[]): SeedSession[] {
  const byName = new Map(exercises.map((e) => [e.name, e]));
  const history: HistoryRow[] = [];
  const seen = new Map<string, number>(); // exercise → sessions so far
  const sessions: SeedSession[] = [];

  let sessionIndex = 0;
  for (let w = 0; w < WEEKLY_LOSS_PCT.length; w++) {
    for (const d of WORKOUT_DAYS) {
      const date = addDays(firstWeek, w * 7 + d);
      if (date >= today) continue;

      const sessionId = `seed-${sessionIndex}`;
      const started = `${date}T18:00:00.000Z`;
      const names = sessionIndex % 2 === 0 ? WORKOUT_A : WORKOUT_B;
      sessionIndex++;

      const sets: SeedSet[] = [];
      for (const name of names) {
        const config = byName.get(name);
        if (!config) continue;

        // The weight comes from the engine, exactly as the app would suggest it.
        const target = nextTarget(config, sessionsForExercise(history, name));
        const weight = target.weight_kg ?? START_WEIGHTS[name] ?? 20;

        const n = seen.get(name) ?? 0;
        seen.set(name, n + 1);
        const outcome = SESSION_PATTERNS[name]?.[n] ?? "H";

        for (let i = 0; i < config.target_sets; i++) {
          const last = i === config.target_sets - 1;
          const missedRep = outcome === "M" && last;
          const set = {
            exercise: name,
            set_number: i + 1,
            weight_kg: weight,
            reps: missedRep ? config.target_reps - 1 : config.target_reps,
            rir: outcome === "S" ? 3 : outcome === "M" ? (last ? 0 : 1) : last ? 1 : 2,
          };
          sets.push(set);
          history.push({
            session_id: sessionId,
            performed_on: date,
            started_at: started,
            exercise_id: name, // names stand in for ids here
            weight_kg: set.weight_kg,
            reps: set.reps,
            rir: set.rir,
          });
        }
      }

      sessions.push({
        performed_on: date,
        started_at: started,
        finished_at: `${date}T19:00:00.000Z`,
        sets,
      });
    }
  }
  return sessions;
}

export function buildScenario(args: { today: string; exercises: SeedExercise[] }): Scenario {
  const { today, exercises } = args;
  const lastFinishedWeek = addDays(mondayOf(today), -7);
  const firstWeek = addDays(lastFinishedWeek, -49);
  const rand = mulberry32(42);

  return {
    weeks: Array.from({ length: 8 }, (_, i) => addDays(firstWeek, i * 7)),
    dailyLogs: buildDailyLogs(today, firstWeek, rand),
    wellbeing: WELLBEING.map(([mood, energy, motivation], i) => ({
      week_start: addDays(firstWeek, i * 7),
      mood,
      energy,
      motivation,
    })),
    sessions: buildSessions(today, firstWeek, exercises),
  };
}
