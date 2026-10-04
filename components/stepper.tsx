"use client";

import { useState } from "react";

type Props = {
  name: string;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  decimals: number;
  /** Value used when the field is empty and a ± button is tapped. */
  startAt: number;
  defaultValue?: string;
  error?: string;
};

function format(n: number, decimals: number) {
  const factor = 10 ** decimals;
  return (Math.round(n * factor) / factor).toFixed(decimals);
}

/** Decimal input with big − / + buttons. The input itself stays typeable. */
export function Stepper({
  name,
  label,
  unit,
  step,
  min,
  max,
  decimals,
  startAt,
  defaultValue = "",
  error,
}: Props) {
  const [value, setValue] = useState(defaultValue);

  function nudge(direction: 1 | -1) {
    const current = Number(value);
    const next =
      value.trim() === "" || Number.isNaN(current)
        ? startAt
        : current + direction * step;
    setValue(format(Math.min(max, Math.max(min, next)), decimals));
  }

  const button =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-300 text-2xl font-medium active:scale-95 active:bg-zinc-100 dark:border-zinc-700 dark:active:bg-zinc-800";

  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label={`Decrease ${label} by ${step}`}
          className={button}
        >
          −
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={name}
            name={name}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${name}-error` : undefined}
            className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 pr-12 text-center text-lg font-semibold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 aria-[invalid=true]:border-red-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">
            {unit}
          </span>
        </div>
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label={`Increase ${label} by ${step}`}
          className={button}
        >
          +
        </button>
      </div>
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
