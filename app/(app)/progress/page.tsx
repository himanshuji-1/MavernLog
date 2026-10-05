import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { formatShortDate } from "@/lib/dates";
import { strengthSeries, summarize, withTrend, type StrengthPoint } from "@/lib/progress";
import { loadWeights } from "@/lib/progress-data";
import { createClient } from "@/lib/supabase/server";
import { resolveToday } from "@/lib/today";
import { loadExercises, loadHistory } from "@/lib/workout-data";
import { StrengthChart } from "./strength-chart";
import { WeightChart } from "./weight-chart";

export const metadata: Metadata = { title: "Progress" };

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tracking-tight">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

const kg = (n: number) => `${Number(n.toFixed(1))} kg`;

export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const params = await searchParams;
  const asOf = typeof params.asOf === "string" ? params.asOf : null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, start_weight_kg, goal_weight_kg")
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const today = resolveToday(profile.timezone, asOf);
  const [weights, exercises, history] = await Promise.all([
    loadWeights(supabase),
    loadExercises(supabase),
    loadHistory(supabase, today, null),
  ]);

  const goal = Number(profile.goal_weight_kg);
  const summary = summarize({
    points: weights,
    startWeightKg: Number(profile.start_weight_kg),
    goalWeightKg: goal,
  });
  const trend = withTrend(weights);

  // Only exercises that have been trained appear in the picker.
  const trained = exercises.filter((e) => history.some((r) => r.exercise_id === e.id));
  const series: Record<string, StrengthPoint[]> = Object.fromEntries(
    trained.map((e) => [e.id, strengthSeries(history, e.id)]),
  );

  const lost = summary.totalLostKg;
  const staleAsOf = summary.asOf !== null && summary.asOf < today ? formatShortDate(summary.asOf) : null;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Progress</h1>

      <dl className="grid grid-cols-2 gap-3">
        <Tile
          label="7-day average"
          value={summary.currentAvg === null ? "—" : kg(summary.currentAvg)}
          hint={staleAsOf ? `as of ${staleAsOf}` : undefined}
        />
        <Tile
          label={lost !== null && lost < 0 ? "Total gained" : "Total lost"}
          value={lost === null ? "—" : kg(Math.abs(lost))}
          hint={`since ${kg(Number(profile.start_weight_kg))}`}
        />
        <Tile
          label="Avg weekly loss"
          value={summary.avgWeeklyLossPct === null ? "—" : `${summary.avgWeeklyLossPct}%`}
          hint="goal 0.3–0.7%"
        />
        <Tile
          label="To goal"
          value={summary.toGoalKg === null ? "—" : summary.goalReached ? "Reached 🎉" : kg(summary.toGoalKg)}
          hint={`goal ${kg(goal)}`}
        />
      </dl>

      <WeightChart trend={trend} goalKg={goal} today={today} />
      <StrengthChart options={trained.map((e) => ({ id: e.id, name: e.name }))} series={series} />
    </section>
  );
}
