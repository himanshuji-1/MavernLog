import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { formatShortDate } from "@/lib/dates";
import { bestE1rm } from "@/lib/engine/e1rm";
import { formatKg, formatTarget } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { resolveToday } from "@/lib/today";
import { loadExercises, loadHistory, targetsFor } from "@/lib/workout-data";
import { finishWorkout } from "../actions";
import { ExerciseLogger, type LoggedSet } from "./exercise-logger";

const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export const metadata: Metadata = { title: "Workout" };

export default async function WorkoutSessionPage({
  params,
  searchParams,
}: PageProps<"/workout/[sessionId]">) {
  const { sessionId } = await params;
  if (!z.uuid().safeParse(sessionId).success) notFound();
  const query = await searchParams;

  const supabase = await createClient();
  const [{ data: profile }, { data: session }] = await Promise.all([
    supabase.from("profiles").select("timezone").maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id, performed_on, finished_at")
      .eq("id", sessionId)
      .maybeSingle(),
  ]);
  if (!profile) redirect("/onboarding");
  if (!session) notFound();

  const finished = session.finished_at !== null;
  const today = resolveToday(profile.timezone, first(query.asOf));

  const [exercises, history, setsResult] = await Promise.all([
    loadExercises(supabase),
    loadHistory(supabase, today),
    supabase
      .from("workout_sets")
      .select("exercise_id, set_number, weight_kg, reps, rir")
      .eq("session_id", sessionId)
      .order("set_number"),
  ]);

  const setsByExercise = new Map<string, LoggedSet[]>();
  for (const s of setsResult.data ?? []) {
    const list = setsByExercise.get(s.exercise_id) ?? [];
    list.push({ set_number: s.set_number, weight_kg: Number(s.weight_kg), reps: s.reps, rir: s.rir });
    setsByExercise.set(s.exercise_id, list);
  }

  // Exercises chosen at the start (?ex=…), then any others that already have sets.
  const known = new Map(exercises.map((e) => [e.id, e]));
  const chosen = (first(query.ex) ?? "")
    .split(",")
    .filter((id) => z.uuid().safeParse(id).success && known.has(id));
  const orderedIds = finished ? [] : chosen;
  for (const id of setsByExercise.keys()) if (!orderedIds.includes(id)) orderedIds.push(id);
  const sessionExercises = orderedIds.flatMap((id) => known.get(id) ?? []);

  if (!finished && sessionExercises.length === 0) redirect("/workout");

  // While logging: target = what was asked for this session (history before it).
  // Once finished: the same calculation including it = "next time".
  const targets = targetsFor(sessionExercises, history, finished ? undefined : sessionId);
  const totalSets = [...setsByExercise.values()].reduce((n, l) => n + l.length, 0);

  const header = (
    <div>
      <Link href="/workout" className="inline-flex min-h-11 items-center text-sm text-zinc-500 dark:text-zinc-400">
        ← Workout
      </Link>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">
        {finished ? "Workout done" : "Workout"}{" "}
        <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">{formatShortDate(session.performed_on)}</span>
      </h1>
    </div>
  );

  if (finished) {
    return (
      <section className="flex flex-col gap-4">
        {header}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {totalSets} sets logged. Nice work.
        </p>
        {sessionExercises.map((e) => {
          const sets = setsByExercise.get(e.id) ?? [];
          const e1rm = bestE1rm(sets);
          const next = targets.get(e.id)!;
          return (
            <article key={e.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="text-lg font-bold">{e.name}</h2>
              <ul className="mt-2 text-sm">
                {sets.map((s) => (
                  <li key={s.set_number}>
                    Set {s.set_number}: {formatKg(s.weight_kg)} × {s.reps} · RIR {s.rir}
                  </li>
                ))}
              </ul>
              {e1rm !== null && (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  Estimated 1RM (Epley): <span className="font-semibold text-foreground">{formatKg(Number(e1rm.toFixed(1)))}</span>
                </p>
              )}
              <p className="mt-2 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Next time:</span>{" "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatTarget(next)}</span>
                <span className="block text-zinc-600 dark:text-zinc-400">{next.reason}</span>
              </p>
            </article>
          );
        })}
        <Link
          href="/workout"
          className="flex h-12 items-center justify-center rounded-xl bg-emerald-700 text-base font-semibold text-white active:scale-[0.98]"
        >
          Done
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {header}
      {sessionExercises.map((e) => {
        const sets = setsByExercise.get(e.id) ?? [];
        return (
          <ExerciseLogger
            // Re-mount when the saved sets change so each form starts fresh.
            key={`${e.id}:${sets.map((s) => `${s.set_number}-${s.weight_kg}-${s.reps}-${s.rir}`).join("|")}`}
            sessionId={sessionId}
            exercise={{ id: e.id, name: e.name, target_sets: e.target_sets }}
            target={targets.get(e.id)!}
            sets={sets}
          />
        );
      })}

      <form action={finishWorkout}>
        <input type="hidden" name="session_id" value={sessionId} />
        <button
          type="submit"
          className="h-12 w-full rounded-xl border border-emerald-600 text-base font-semibold text-emerald-700 active:scale-[0.98] dark:text-emerald-400"
        >
          {totalSets === 0 ? "Cancel workout" : `Finish workout (${totalSets} sets)`}
        </button>
      </form>
    </section>
  );
}
