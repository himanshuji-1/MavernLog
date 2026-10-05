"use client";

import { useActionState } from "react";
import { ChoiceGroup } from "@/components/choice-group";
import { saveExercise } from "./actions";

type Exercise = {
  id: string;
  name: string;
  body_region: "upper" | "lower";
  target_sets: number;
  target_reps: number;
};

const REGIONS = [
  { value: "upper", label: "Upper body" },
  { value: "lower", label: "Lower body" },
];

const input =
  "h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 aria-[invalid=true]:border-red-500 dark:border-zinc-700 dark:bg-zinc-900";

export function ExerciseForm({ exercise }: { exercise?: Exercise }) {
  const [state, formAction, pending] = useActionState(saveExercise, null);
  // After a successful save, fall back to the saved values (blank for "add").
  const v = state && !state.saved ? state.values : {};
  const e = state?.fieldErrors ?? {};
  const pick = (key: string, saved: string) => (key in v ? v[key] : saved);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {exercise && <input type="hidden" name="id" value={exercise.id} />}

      <div>
        <label htmlFor={`name-${exercise?.id ?? "new"}`} className="mb-1.5 block text-sm font-medium">
          Name
        </label>
        <input
          id={`name-${exercise?.id ?? "new"}`}
          name="name"
          type="text"
          maxLength={60}
          autoComplete="off"
          required
          aria-invalid={Boolean(e.name)}
          defaultValue={pick("name", exercise?.name ?? "")}
          className={input}
        />
        {e.name && (
          <p role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {e.name}
          </p>
        )}
      </div>

      <ChoiceGroup
        name="body_region"
        legend="Body region"
        hint="decides the weight jump: +2.5 kg upper, +5 kg lower"
        options={REGIONS}
        defaultValue={pick("body_region", exercise?.body_region ?? "")}
        error={e.body_region}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`sets-${exercise?.id ?? "new"}`} className="mb-1.5 block text-sm font-medium">
            Sets
          </label>
          <input
            id={`sets-${exercise?.id ?? "new"}`}
            name="target_sets"
            type="text"
            inputMode="numeric"
            required
            aria-invalid={Boolean(e.target_sets)}
            defaultValue={pick("target_sets", String(exercise?.target_sets ?? 3))}
            className={input}
          />
          {e.target_sets && (
            <p role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
              {e.target_sets}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`reps-${exercise?.id ?? "new"}`} className="mb-1.5 block text-sm font-medium">
            Reps per set
          </label>
          <input
            id={`reps-${exercise?.id ?? "new"}`}
            name="target_reps"
            type="text"
            inputMode="numeric"
            required
            aria-invalid={Boolean(e.target_reps)}
            defaultValue={pick("target_reps", String(exercise?.target_reps ?? 5))}
            className={input}
          />
          {e.target_reps && (
            <p role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
              {e.target_reps}
            </p>
          )}
        </div>
      </div>

      {state?.formError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.formError}
        </p>
      )}
      {state?.saved && exercise && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Saved ✓
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-emerald-700 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Saving…" : exercise ? "Save changes" : "Add exercise"}
      </button>
    </form>
  );
}
