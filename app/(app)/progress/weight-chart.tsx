"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import {
  CHART_COLORS,
  EmptyChart,
  Segmented,
  TooltipBox,
  formatAxisDate,
  formatTooltipDate,
  toTime,
} from "@/components/chart-parts";
import { filterByRange, type RangeKey, type TrendPoint } from "@/lib/progress";

const RANGES: { value: RangeKey; label: string }[] = [
  { value: "4w", label: "4 weeks" },
  { value: "8w", label: "8 weeks" },
  { value: "all", label: "All" },
];

type Row = { t: number; weight: number; avg: number | null };

function WeightTooltip({ active, payload }: TooltipContentProps) {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <TooltipBox title={formatTooltipDate(row.t)}>
      <p>Weight: {row.weight} kg</p>
      {row.avg !== null && <p className="text-emerald-700 dark:text-emerald-400">7-day average: {row.avg} kg</p>}
    </TooltipBox>
  );
}

export function WeightChart({
  trend,
  goalKg,
  today,
}: {
  trend: TrendPoint[];
  goalKg: number;
  today: string;
}) {
  const [range, setRange] = useState<RangeKey>("8w");

  const rows: Row[] = useMemo(
    () => filterByRange(trend, range, today).map((p) => ({ t: toTime(p.date), weight: p.kg, avg: p.avg })),
    [trend, range, today],
  );

  if (trend.length === 0) {
    return (
      <EmptyChart title="Weight">
        No weigh-ins yet. Log your weight on the{" "}
        <Link href="/today" className="font-medium text-emerald-700 underline dark:text-emerald-400">
          Today tab
        </Link>{" "}
        and your trend will appear here.
      </EmptyChart>
    );
  }

  const weights = rows.map((r) => r.weight);
  const lo = Math.floor(Math.min(...weights, goalKg) - 0.5);
  const hi = Math.ceil(Math.max(...weights, goalKg) + 0.5);
  const first = rows[0]?.t;
  const last = rows[rows.length - 1]?.t;
  const DAY = 86_400_000;
  // A single point still needs a visible axis span.
  const xDomain: [number, number] | undefined =
    first !== undefined && last !== undefined
      ? first === last
        ? [first - 3 * DAY, last + 3 * DAY]
        : [first, last]
      : undefined;

  const latestAvg = [...rows].reverse().find((r) => r.avg !== null)?.avg;
  const summary =
    rows.length === 0
      ? "No weigh-ins in this range."
      : `Weight chart, ${rows.length} weigh-ins from ${formatAxisDate(rows[0].t)} to ${formatAxisDate(
          rows[rows.length - 1].t,
        )}, latest ${rows[rows.length - 1].weight} kg${
          latestAvg ? `, 7-day average ${latestAvg} kg` : ""
        }, goal ${goalKg} kg.`;

  return (
    <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-3 font-semibold">Weight</h2>
      <Segmented label="Time range" value={range} options={RANGES} onChange={setRange} />

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-600 dark:text-zinc-400">
          No weigh-ins in the last {range === "4w" ? "4" : "8"} weeks.
        </p>
      ) : (
        <>
          <div role="img" aria-label={summary} className="mt-3 text-zinc-500 dark:text-zinc-400">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
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
                <Tooltip content={WeightTooltip} cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }} />
                <ReferenceLine
                  y={goalKg}
                  stroke={CHART_COLORS.goal}
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  label={{ value: `Goal ${goalKg}`, position: "insideTopRight", fill: CHART_COLORS.goal, fontSize: 12 }}
                />
                {/* Daily weigh-ins: dots only */}
                <Line
                  dataKey="weight"
                  stroke="none"
                  isAnimationActive={false}
                  dot={{ r: 3, fill: CHART_COLORS.dots, stroke: "none" }}
                  activeDot={{ r: 5, fill: CHART_COLORS.dots }}
                  legendType="none"
                />
                {/* 7-day average: the line */}
                <Line
                  dataKey="avg"
                  stroke={CHART_COLORS.line}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: CHART_COLORS.line }}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400" aria-hidden="true">
            <li className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS.dots }} /> Daily weigh-in
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-1 w-4 rounded" style={{ background: CHART_COLORS.line }} /> 7-day average
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: CHART_COLORS.goal }} /> Goal
            </li>
          </ul>

          <details className="mt-3 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium text-emerald-700 dark:text-emerald-400">
              Show data
            </summary>
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-background text-xs text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-1 font-medium">Date</th>
                    <th className="py-1 font-medium">Weight</th>
                    <th className="py-1 font-medium">7-day avg</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.t} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-1">{formatTooltipDate(r.t)}</td>
                      <td className="py-1">{r.weight} kg</td>
                      <td className="py-1">{r.avg === null ? "—" : `${r.avg} kg`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
