"use client";

import { useActionState, useState } from "react";
import { ChoiceGroup } from "@/components/choice-group";
import { Stepper } from "@/components/stepper";
import { saveDailyLog } from "./actions";

export type ExistingLog = {
  bodyweight_kg: number | null;
  steps: number | null;
  sleep_hours: number | null;
  diet_followed: "yes" | "mostly" | "no" | null;
  hunger: number | null;
} | null;

const DIET = [
  { value: "yes", label: "Yes" },
  { value: "mostly", label: "Mostly" },
  { value: "no", label: "No" },
];
const HUNGER = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
const DIET_LABEL = { yes: "Yes", mostly: "Mostly", no: "No" } as const;

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function DailyLogCard({
  date,
  existing,
  fallbackWeight,
  asOf,
}: {
  date: string;
  existing: ExistingLog;
  /** Last known bodyweight, used to prefill the field and as the stepper start. */
  fallbackWeight: number;
  asOf: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveDailyLog, null);
  // The parent re-keys this component after every save, so a saved log always
  // starts in summary mode.
  const [editing, setEditing] = useState(existing === null);

  if (existing && !editing) {
    return (
      <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Daily log</h2>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Logged ✓
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          {[
            ["Weight", existing.bodyweight_kg === null ? null : `${existing.bodyweight_kg} kg`],
            ["Steps", existing.steps === null ? null : existing.steps.toLocaleString()],
            ["Sleep", existing.sleep_hours === null ? null : `${existing.sleep_hours} h`],
            ["Diet", existing.diet_followed ? DIET_LABEL[existing.diet_followed] : null],
            ["Hunger", existing.hunger === null ? null : `${existing.hunger} / 5`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
              <dd className="text-lg font-semibold">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 h-12 w-full rounded-xl border border-zinc-300 text-base font-medium active:scale-[0.98] dark:border-zinc-700"
        >
          Edit
        </button>
      </section>
    );
  }

  const v = state?.values ?? {};
  const e = state?.fieldErrors ?? {};
  // Re-show what was typed after a failed save; otherwise start from the saved
  // log, or (new day) from the last known weight.
  const pick = (key: string, saved: string) => (key in v ? v[key] : saved);
  const formError = e.form ?? e.log_date ?? state?.formError;

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-semibold">Daily log</h2>
      <input type="hidden" name="log_date" value={date} />
      {asOf && <input type="hidden" name="as_of" value={asOf} />}

      <Stepper
        name="bodyweight_kg"
        label="Bodyweight"
        unit="kg"
        step={0.1}
        min={30}
        max={300}
        decimals={1}
        startAt={fallbackWeight}
        defaultValue={pick("bodyweight_kg", str(existing?.bodyweight_kg ?? fallbackWeight))}
        error={e.bodyweight_kg}
      />

      <div>
        <label htmlFor="steps" className="mb-1.5 block text-sm font-medium">
          Steps
        </label>
        <input
          id="steps"
          name="steps"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 8500"
          defaultValue={pick("steps", str(existing?.steps))}
          aria-invalid={Boolean(e.steps)}
          className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-lg font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 aria-[invalid=true]:border-red-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {e.steps && (
          <p role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {e.steps}
          </p>
        )}
      </div>

      <Stepper
        name="sleep_hours"
        label="Sleep"
        unit="h"
        step={0.5}
        min={0}
        max={24}
        decimals={1}
        startAt={7}
        defaultValue={pick("sleep_hours", str(existing?.sleep_hours))}
        error={e.sleep_hours}
      />

      <ChoiceGroup
        name="diet_followed"
        legend="Diet followed?"
        options={DIET}
        defaultValue={pick("diet_followed", existing?.diet_followed ?? "")}
        error={e.diet_followed}
      />

      <ChoiceGroup
        name="hunger"
        legend="Hunger"
        hint="1 = not hungry, 5 = starving"
        options={HUNGER}
        defaultValue={pick("hunger", str(existing?.hunger))}
        error={e.hunger}
      />

      {formError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-emerald-700 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
