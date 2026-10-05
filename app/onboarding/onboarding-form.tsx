"use client";

import { useActionState, useState } from "react";
import { MIN_SAFE_CALORIES } from "@/lib/validation/profile";
import { completeOnboarding } from "./actions";

type FieldProps = {
  name: string;
  label: string;
  unit: string;
  inputMode: "decimal" | "numeric";
  placeholder: string;
  defaultValue?: string;
  error?: string;
  onChange?: (value: string) => void;
  hint?: string;
};

function Field({
  name,
  label,
  unit,
  inputMode,
  placeholder,
  defaultValue,
  error,
  onChange,
  hint,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          placeholder={placeholder}
          defaultValue={defaultValue}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 pr-14 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 aria-[invalid=true]:border-red-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-zinc-500 dark:text-zinc-400">
          {unit}
        </span>
      </div>
      {hint && !error && <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(completeOnboarding, null);
  const v = state?.values ?? {};
  const e = state?.fieldErrors ?? {};
  const [calories, setCalories] = useState(v.calorie_target ?? "");
  const lowCalories =
    calories !== "" && Number(calories) > 0 && Number(calories) < MIN_SAFE_CALORIES;

  return (
    <form
      action={(formData) => {
        // Read at submit time (not render) so server and client HTML match.
        formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
        formAction(formData);
      }}
      className="flex flex-col gap-5"
    >
      <Field name="height_cm" label="Height" unit="cm" inputMode="decimal" placeholder="178" defaultValue={v.height_cm} error={e.height_cm} />
      <Field name="start_weight_kg" label="Current weight" unit="kg" inputMode="decimal" placeholder="90" defaultValue={v.start_weight_kg} error={e.start_weight_kg} />
      <Field name="goal_weight_kg" label="Goal weight" unit="kg" inputMode="decimal" placeholder="80" defaultValue={v.goal_weight_kg} error={e.goal_weight_kg} />
      <div>
        <Field
          name="calorie_target"
          label="Daily calorie target"
          unit="kcal"
          inputMode="numeric"
          placeholder="2200"
          defaultValue={v.calorie_target}
          error={e.calorie_target}
          onChange={setCalories}
        />
        {lowCalories && (
          <p
            role="status"
            className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            That&apos;s under {MIN_SAFE_CALORIES.toLocaleString()} kcal. MavernLog
            never recommends going below {MIN_SAFE_CALORIES.toLocaleString()}, and
            your weekly review will nudge you back up to it.
          </p>
        )}
      </div>
      <Field name="protein_target_g" label="Daily protein target" unit="g" inputMode="numeric" placeholder="160" defaultValue={v.protein_target_g} error={e.protein_target_g} />

      {state?.formError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-12 w-full rounded-xl bg-emerald-700 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Start tracking"}
      </button>
    </form>
  );
}
