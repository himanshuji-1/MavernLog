"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import {
  CHART_COLORS,
  EmptyChart,
  TooltipBox,
  formatAxisDate,
  formatTooltipDate,
  toTime,
} from "@/components/chart-parts";
import type { StrengthPoint } from "@/lib/progress";

type Row = { t: number; e1rm: number; weight_kg: number; reps: number };

function StrengthTooltip({ active, payload }: TooltipContentProps) {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox title={formatTooltipDate(row.t)}>
      <p className="text-emerald-700 dark:text-emerald-400">Est. 1RM: {row.e1rm} kg</p>
      <p>
        Best set: {row.weight_kg} kg × {row.reps}
      </p>
    </TooltipBox>
  );
}

export function StrengthChart({
  options,
  series,
}: {
  options: { id: string; name: string }[];
  series: Record<string, StrengthPoint[]>;
}) {
  const [selected, setSelected] = useState(options[0]?.id ?? "");

  if (options.length === 0) {
    return (
      <EmptyChart title="Strength">
        No workouts yet. Finish one on the{" "}
        <Link href="/workout" className="font-medium text-emerald-700 underline dark:text-emerald-400">
          Workout tab
        </Link>{" "}
        and your estimated 1RM will be charted here.
      </EmptyChart>
    );
  }

  const points = series[selected] ?? [];
  const rows: Row[] = points.map((p) => ({ t: toTime(p.date), e1rm: p.e1rm, weight_kg: p.weight_kg, reps: p.reps }));
  const name = options.find((o) => o.id === selected)?.name ?? "";

  const values = rows.map((r) => r.e1rm);
  const lo = Math.floor(Math.min(...values) - 2);
  const hi = Math.ceil(Math.max(...values) + 2);
  const DAY = 86_400_000;
  const first = rows[0]?.t;
  const last = rows[rows.length - 1]?.t;
  const xDomain: [number, number] | undefined =
    first !== undefined && last !== undefined
      ? first === last
        ? [first - 3 * DAY, last + 3 * DAY]
        : [first, last]
      : undefined;

  const summary = `${name} estimated one-rep max over ${rows.length} sessions, from ${rows[0].e1rm} kg to ${
    rows[rows.length - 1].e1rm
  } kg.`;

  return (
    <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-3 font-semibold">Strength</h2>

      <label htmlFor="strength-exercise" className="mb-1.5 block text-sm font-medium">
        Exercise
      </label>
      <select
        id="strength-exercise"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <div role="img" aria-label={summary} className="mt-3 text-zinc-500 dark:text-zinc-400">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.15} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={xDomain}
              tickFormatter={formatAxisDate}
              tickCount={4}
              stroke="currentColor"
              tick={{ fill: "currentColor", fontSize: 12 }}
            />
            <YAxis
              domain={[lo, hi]}
              allowDecimals={false}
              width={44}
              stroke="currentColor"
              tick={{ fill: "currentColor", fontSize: 12 }}
            />
            <Tooltip content={StrengthTooltip} cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }} />
            <Line
              dataKey="e1rm"
              stroke={CHART_COLORS.line}
              strokeWidth={3}
              dot={{ r: 4, fill: CHART_COLORS.line, stroke: "none" }}
              activeDot={{ r: 6, fill: CHART_COLORS.line }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        Estimated 1RM (Epley) from your best set each session. Dips usually mean a deload.
        {rows.length === 1 && " Log another session to see a trend."}
      </p>
    </section>
  );
}
