import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadExercises, type Exercise } from "@/lib/workout-data";
import { setArchived } from "./actions";
import { ExerciseForm } from "./exercise-form";

function ArchiveButton({ exercise, archive }: { exercise: Exercise; archive: boolean }) {
  return (
    <form action={setArchived}>
      <input type="hidden" name="id" value={exercise.id} />
      <input type="hidden" name="archived" value={String(archive)} />
      <button
        type="submit"
        className="h-11 rounded-lg px-3 text-sm font-medium text-zinc-600 active:bg-zinc-100 dark:text-zinc-400 dark:active:bg-zinc-800"
      >
        {archive ? "Archive" : "Restore"}
      </button>
    </form>
  );
}

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesSettingsPage() {
  const supabase = await createClient();
  const exercises = await loadExercises(supabase);
  const active = exercises.filter((e) => !e.archived);
  const archived = exercises.filter((e) => e.archived);

  return (
    <section className="flex flex-col gap-5">
      <div>
        <Link href="/settings" className="inline-flex min-h-11 items-center text-sm text-zinc-500 dark:text-zinc-400">
          ← Settings
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Exercises</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Archiving hides an exercise from new workouts but keeps its history.
        </p>
      </div>

      <details className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">+ Add exercise</summary>
        <div className="mt-3">
          {/* Re-mounted after each add so the form clears. */}
          <ExerciseForm key={exercises.length} />
        </div>
      </details>

      <ul className="flex flex-col gap-2">
        {active.map((e) => (
          <li key={e.id} className="rounded-2xl border border-zinc-200 px-4 dark:border-zinc-800">
            <details>
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{e.name}</span>
                  <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {e.body_region} · {e.target_sets} × {e.target_reps}
                  </span>
                </span>
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Edit</span>
              </summary>
              <div className="pb-4 pt-2">
                <ExerciseForm
                  key={`${e.id}:${e.name}:${e.body_region}:${e.target_sets}:${e.target_reps}`}
                  exercise={e}
                />
                <div className="mt-2 flex justify-end">
                  <ArchiveButton exercise={e} archive />
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Archived</h2>
          <ul className="flex flex-col gap-2">
            {archived.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-2xl border border-dashed border-zinc-300 px-4 py-1 text-zinc-500 dark:text-zinc-400 dark:border-zinc-700"
              >
                <span>{e.name}</span>
                <ArchiveButton exercise={e} archive={false} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
