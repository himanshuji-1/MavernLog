/**
 * Fills ONE user's account with eight weeks of fake data.
 *
 *   npm run seed -- --email you@gmail.com --confirm
 *
 * It WIPES and rewrites that user's daily logs, check-ins, workouts and weekly
 * reviews, and resets their calorie/step targets. Nobody else's data is touched.
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (it bypasses row-level security,
 * so it only ever runs on your own machine). The user must have signed in and
 * finished onboarding first.
 *
 * Open the Review tab afterwards: the weekly reviews are calculated there.
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { todayInTimezone } from "../lib/dates";
import {
  SEED_CALORIE_TARGET,
  SEED_START_WEIGHT_KG,
  SEED_STEP_TARGET,
  buildScenario,
  type SeedExercise,
} from "../lib/seed/scenario";

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local: fall back to variables already in the environment.
  }

  const email = arg("email")?.trim().toLowerCase();
  const confirmed = process.argv.includes("--confirm");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email) fail("Missing --email. Example: npm run seed -- --email you@gmail.com --confirm");
  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is not set (.env.local).");
  if (!serviceKey) {
    fail("SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (Supabase → Project Settings → API → secret key). Never commit it.");
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---- find the user
  let userId: string | null = null;
  for (let page = 1; !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Couldn't list users: ${error.message}`);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }
  if (!userId) fail(`No user with the email ${email}. Sign in to the app with that Google account first.`);

  const { data: profile } = await admin.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (!profile) fail(`${email} hasn't finished onboarding yet. Sign in and complete it first.`);

  const { data: exercises } = await admin
    .from("exercises")
    .select("id, name, body_region, target_sets, target_reps")
    .eq("user_id", userId);
  const seedExercises = (exercises ?? []) as (SeedExercise & { id: string })[];
  if (seedExercises.length === 0) fail("This user has no exercises to train.");

  const today = todayInTimezone(profile.timezone);
  const scenario = buildScenario({ today, exercises: seedExercises });
  const setCount = scenario.sessions.reduce((n, s) => n + s.sets.length, 0);

  console.log(`\nSeed plan for ${email}  (today = ${today}, ${profile.timezone})`);
  console.log(`  ${scenario.dailyLogs.length} daily logs, ${scenario.wellbeing.length} wellbeing check-ins`);
  console.log(`  ${scenario.sessions.length} workouts, ${setCount} sets`);
  console.log(`  targets reset to ${SEED_CALORIE_TARGET} kcal, no step target, start weight ${SEED_START_WEIGHT_KG} kg`);
  console.log(`  DELETES this user's existing logs, check-ins, workouts and weekly reviews first.`);

  if (!confirmed) fail("Nothing was changed. Add --confirm to go ahead.");

  // ---- wipe this user's data (every statement is scoped to user_id)
  for (const table of ["weekly_reviews", "workout_sessions", "wellbeing_checkins", "daily_logs"]) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) fail(`Couldn't clear ${table}: ${error.message}`);
  }

  // ---- reset targets
  const goalOk = Number(profile.goal_weight_kg) < SEED_START_WEIGHT_KG;
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      calorie_target: SEED_CALORIE_TARGET,
      step_target: SEED_STEP_TARGET,
      ...(goalOk ? { start_weight_kg: SEED_START_WEIGHT_KG } : {}),
    })
    .eq("user_id", userId);
  if (profileError) fail(`Couldn't reset targets: ${profileError.message}`);

  // ---- insert
  const insert = async (table: string, rows: Record<string, unknown>[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from(table).insert(rows.slice(i, i + 500));
      if (error) fail(`Couldn't write ${table}: ${error.message}`);
    }
  };

  await insert(
    "daily_logs",
    scenario.dailyLogs.map((l) => ({
      user_id: userId,
      log_date: l.log_date,
      bodyweight_kg: l.bodyweight_kg,
      steps: l.steps,
      sleep_hours: l.sleep_hours,
      diet_followed: l.diet_followed,
      hunger: l.hunger,
    })),
  );

  await insert(
    "wellbeing_checkins",
    scenario.wellbeing.map((w) => ({
      user_id: userId,
      week_start: w.week_start,
      mood: w.mood,
      energy: w.energy,
      motivation: w.motivation,
    })),
  );

  const exerciseId = new Map(seedExercises.map((e) => [e.name, e.id]));
  const sessionRows: Record<string, unknown>[] = [];
  const setRows: Record<string, unknown>[] = [];
  for (const session of scenario.sessions) {
    const id = randomUUID();
    sessionRows.push({
      id,
      user_id: userId,
      performed_on: session.performed_on,
      started_at: session.started_at,
      finished_at: session.finished_at,
    });
    for (const set of session.sets) {
      setRows.push({
        user_id: userId,
        session_id: id,
        exercise_id: exerciseId.get(set.exercise),
        set_number: set.set_number,
        weight_kg: set.weight_kg,
        reps: set.reps,
        rir: set.rir,
      });
    }
  }
  await insert("workout_sessions", sessionRows);
  await insert("workout_sets", setRows);

  console.log(`\n✓ Done. Open the Review tab in the app to see the weekly reviews.\n`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
