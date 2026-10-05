"use client";

import { useActionState } from "react";
import { ChoiceGroup } from "@/components/choice-group";
import { saveWellbeing } from "./actions";

const SCORES = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

export function WellbeingCard({ asOf }: { asOf: string | null }) {
  const [state, formAction, pending] = useActionState(saveWellbeing, null);
  const v = state?.values ?? {};
  const e = state?.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-emerald-600/40 bg-emerald-50 p-4 dark:bg-emerald-950/30"
    >
      <div>
        <h2 className="font-semibold">Weekly check-in</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          How has this week felt? 1 = really low, 5 = great.
        </p>
      </div>
      {asOf && <input type="hidden" name="as_of" value={asOf} />}

      <ChoiceGroup name="mood" legend="Mood" options={SCORES} defaultValue={v.mood} error={e.mood} />
      <ChoiceGroup name="energy" legend="Energy" options={SCORES} defaultValue={v.energy} error={e.energy} />
      <ChoiceGroup
        name="motivation"
        legend="Motivation"
        options={SCORES}
        defaultValue={v.motivation}
        error={e.motivation}
      />

      {state?.formError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-emerald-700 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save check-in"}
      </button>
    </form>
  );
}
