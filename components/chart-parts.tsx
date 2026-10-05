"use client";

/** Shared pieces for the Recharts charts. */

export const CHART_COLORS = {
  line: "#10b981", // emerald: the trend you care about
  dots: "#a1a1aa", // zinc: raw daily values
  goal: "#f59e0b", // amber: the target
};

/** "2026-10-04" → UTC midday timestamp (for Recharts' numeric time axis). */
export const toTime = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();

export const formatAxisDate = (t: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(t));

export const formatTooltipDate = (t: number) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(t));

export function TooltipBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-semibold">{title}</p>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-11 flex-1 rounded-lg text-sm font-medium transition ${
            value === o.value
              ? "bg-white shadow-sm dark:bg-zinc-950"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyChart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{children}</p>
    </section>
  );
}
