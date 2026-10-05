import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { addDays } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { resolveToday } from "@/lib/today";
import { lastWorkoutExerciseIds, loadExercises, loadHistory, targetsFor } from "@/lib/workout-data";
import { StartWorkoutForm } from "./start-workout-form";

const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export const metadata: Metadata = { title: "Workout" };

export default async function WorkoutPage({ searchParams }: PageProps<"/workout">) {
  const params = await searchParams;
  const asOf = first(params.asOf);
  const repeat = first(params.repeat) === "1";

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("timezone").maybeSingle();
  if (!profile) redirect("/onboarding");
  const today = resolveToday(profile.timezone, asOf);

  const [allExercises, history, openSession] = await Promise.all([
    loadExercises(supabase),
    loadHistory(supabase, today),
    // An unfinished workout from today or yesterday can be resumed.
    supabase
      .from("workout_sessions")
      .select("id, performed_on")
      .is("finished_at", null)
      .gte("performed_on", addDays(today, -1))
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const exercises = allExercises.filter((e) => !e.archived);
  const targets = targetsFor(exercises, history);
  const lastIds = lastWorkoutExerciseIds(history).filter((id) => exercises.some((e) => e.id === id));
  const preselected = repeat ? lastIds : [];

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Workout</h1>

      {openSession.data && (
        <Link
          href={`/workout/${openSession.data.id}`}
          className="flex h-12 items-center justify-center rounded-xl border border-emerald-600 text-base font-semibold text-emerald-700 active:scale-[0.98] dark:text-emerald-400"
        >
          Resume unfinished workout
        </Link>
      )}

      {exercises.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:text-zinc-400 dark:border-zinc-700">
          You have no active exercises.{" "}
          <Link href="/settings/exercises" className="font-medium text-emerald-700 underline dark:text-emerald-400">
            Add one in Settings
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Pick today&apos;s exercises. Each card shows what to lift.
            </p>
            {lastIds.length > 0 && !repeat && (
              <Link
                href={asOf ? `/workout?repeat=1&asOf=${asOf}` : "/workout?repeat=1"}
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-zinc-300 px-3 text-sm font-medium active:scale-95 dark:border-zinc-700"
              >
                Repeat last
              </Link>
            )}
          </div>
          <StartWorkoutForm
            key={repeat ? "repeat" : "fresh"}
            asOf={asOf}
            preselected={preselected}
            exercises={exercises.map((e) => ({
              id: e.id,
              name: e.name,
              body_region: e.body_region,
              target: targets.get(e.id)!,
            }))}
          />
        </>
      )}
    </section>
  );
}
