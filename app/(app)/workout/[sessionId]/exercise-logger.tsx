"use client";

import { useActionState, useState } from "react";
import { ChoiceGroup } from "@/components/choice-group";
import { Stepper } from "@/components/stepper";
import type { Target } from "@/lib/engine/progression";
import { formatKg, formatTarget } from "@/lib/format";
import { deleteSet, saveSet } from "../actions";

export type LoggedSet = { set_number: number; weight_kg: number; reps: number; rir: number };

const RIR_OPTIONS = [0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

function SetForm({
  sessionId,
  exerciseId,
  setNumber,
  initial,
  target,
  onCancel,
  onDeleteForm,
}: {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  initial: { weight: string; reps: string; rir: string };
  target: Target;
  onCancel?: () => void;
  onDeleteForm?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(saveSet, null);
  const e = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  const pick = (key: string, fallback: string) => (key in v ? v[key] : fallback);

  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="session_id" value={sessionId} />
        <input type="hidden" name="exercise_id" value={exerciseId} />
        <input type="hidden" name="set_number" value={setNumber} />
        <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Set {setNumber}</h3>

        <Stepper
          name="weight_kg"
          label="Weight"
          unit="kg"
          step={2.5}
          min={0}
          max={1000}
          decimals={1}
          startAt={target.weight_kg ?? 20}
          defaultValue={pick("weight_kg", initial.weight)}
          error={e.weight_kg}
        />
        <Stepper
          name="reps"
          label="Reps"
          unit="reps"
          step={1}
          min={1}
          max={100}
          decimals={0}
          startAt={target.reps}
          defaultValue={pick("reps", initial.reps)}
          error={e.reps}
        />
        <ChoiceGroup
          name="rir"
          legend="Reps in reserve (RIR)"
          hint="0 = nothing left"
          options={RIR_OPTIONS}
          defaultValue={pick("rir", initial.rir)}
          error={e.rir}
        />

        {(state?.formError ?? e.form) && (
          <p role="alert" className="text-sm text-red-600">
            {state?.formError ?? e.form}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Saving…" : `Log set ${setNumber} ✓`}
        </button>
      </form>

      {(onCancel || onDeleteForm) && (
        <div className="mt-2 flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-11 flex-1 rounded-xl border border-zinc-300 text-sm font-medium dark:border-zinc-700"
            >
              Cancel
            </button>
          )}
          {onDeleteForm}
        </div>
      )}
    </div>
  );
}

export function ExerciseLogger({
  sessionId,
  exercise,
  target,
  sets,
}: {
  sessionId: string;
  exercise: { id: string; name: string; target_sets: number };
  target: Target;
  sets: LoggedSet[];
}) {
  // The parent re-keys this component whenever the saved sets change, so these
  // pieces of UI state reset themselves after every save or delete.
  const [editing, setEditing] = useState<number | null>(null);
  const [addingExtra, setAddingExtra] = useState(false);

  const lastSet = sets[sets.length - 1];
  const nextNumber = (lastSet?.set_number ?? 0) + 1;
  const showNext = sets.length < exercise.target_sets || addingExtra;

  return (
    <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-bold">{exercise.name}</h2>
      <p className="font-semibold text-emerald-700 dark:text-emerald-400">{formatTarget(target)}</p>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{target.reason}</p>

      <div className="flex flex-col gap-2">
        {sets.map((s) =>
          editing === s.set_number ? (
            <SetForm
              key={`edit-${s.set_number}`}
              sessionId={sessionId}
              exerciseId={exercise.id}
              setNumber={s.set_number}
              target={target}
              initial={{ weight: String(s.weight_kg), reps: String(s.reps), rir: String(s.rir) }}
              onCancel={() => setEditing(null)}
              onDeleteForm={
                <form action={deleteSet} className="flex-1">
                  <input type="hidden" name="session_id" value={sessionId} />
                  <input type="hidden" name="exercise_id" value={exercise.id} />
                  <input type="hidden" name="set_number" value={s.set_number} />
                  <button
                    type="submit"
                    className="h-11 w-full rounded-xl border border-red-300 text-sm font-medium text-red-600 dark:border-red-900"
                  >
                    Delete set
                  </button>
                </form>
              }
            />
          ) : (
            <div
              key={s.set_number}
              className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30"
            >
              <span className="text-sm">
                <span className="font-semibold">Set {s.set_number}</span>
                {"  "}
                {formatKg(s.weight_kg)} × {s.reps} · RIR {s.rir}
              </span>
              <span className="flex items-center gap-1">
                <span aria-label="Logged" className="text-emerald-600">
                  ✓
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(s.set_number)}
                  className="h-11 rounded-lg px-3 text-sm font-medium text-zinc-600 active:bg-zinc-100 dark:text-zinc-400 dark:active:bg-zinc-800"
                >
                  Edit
                </button>
              </span>
            </div>
          ),
        )}

        {showNext && (
          <SetForm
            key={`new-${nextNumber}`}
            sessionId={sessionId}
            exerciseId={exercise.id}
            setNumber={nextNumber}
            target={target}
            // Carry over the last set's weight, otherwise start from the target.
            initial={{
              weight: lastSet ? String(lastSet.weight_kg) : target.weight_kg === null ? "" : String(target.weight_kg),
              reps: String(target.reps),
              rir: "",
            }}
          />
        )}

        {!showNext && (
          <button
            type="button"
            onClick={() => setAddingExtra(true)}
            className="h-11 rounded-xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            + Add another set
          </button>
        )}
      </div>
    </section>
  );
}
