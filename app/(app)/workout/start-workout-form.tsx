"use client";

import { useActionState } from "react";
import type { Target } from "@/lib/engine/progression";
import { formatTarget } from "@/lib/format";
import { startWorkout } from "./actions";

export type StartExercise = {
  id: string;
  name: string;
  body_region: "upper" | "lower";
  target: Target;
};

export function StartWorkoutForm({
  exercises,
  preselected,
  asOf,
}: {
  exercises: StartExercise[];
  preselected: string[];
  asOf: string | null;
}) {
  const [state, formAction, pending] = useActionState(startWorkout, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {asOf && <input type="hidden" name="as_of" value={asOf} />}

      <ul className="flex flex-col gap-2">
        {exercises.map((e) => (
          <li key={e.id}>
            <label className="block">
              <input
                type="checkbox"
                name="exercise"
                value={e.id}
                defaultChecked={preselected.includes(e.id)}
                className="peer sr-only"
              />
              <span className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 p-4 transition active:scale-[0.99] peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600/40 dark:border-zinc-800 dark:peer-checked:bg-emerald-950/30">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{e.name}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {e.body_region}
                    </span>
                  </span>
                  <span className="mt-1 block text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatTarget(e.target)}
                  </span>
                  <span className="mt-0.5 block text-sm text-zinc-600 dark:text-zinc-400">
                    {e.target.reason}
                  </span>
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {state?.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Starting…" : "Start workout"}
      </button>
    </form>
  );
}
