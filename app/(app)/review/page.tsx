import { redirect } from "next/navigation";
import { formatShortDate } from "@/lib/dates";
import { LOSS_ON_TRACK_MAX_PCT, LOSS_ON_TRACK_MIN_PCT } from "@/lib/engine/weeklyReview";
import { OUTCOME_DISPLAY } from "@/lib/review-display";
import { REVIEW_COLUMNS, normalizeReview, runPendingReviews, type ReviewRow } from "@/lib/reviews";
import { createClient, getUserId } from "@/lib/supabase/server";
import { resolveToday } from "@/lib/today";

const kcal = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, d = 2) => `${Number(n.toFixed(d))}%`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function targetChanges(r: ReviewRow): string[] {
  const changes: string[] = [];
  if (r.calorie_target_after !== r.calorie_target_before) {
    changes.push(`Calories ${kcal(r.calorie_target_before)} → ${kcal(r.calorie_target_after)}`);
  }
  if (r.step_target_after !== r.step_target_before) {
    changes.push(
      `Steps ${r.step_target_before === null ? "none" : kcal(r.step_target_before)} → ${
        r.step_target_after === null ? "none" : kcal(r.step_target_after)
      }`,
    );
  }
  return changes;
}

function ReviewCard({ review, detailed }: { review: ReviewRow; detailed: boolean }) {
  const display = OUTCOME_DISPLAY[review.outcome];
  const changes = targetChanges(review);

  return (
    <article className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Week of {formatShortDate(review.week_start)}</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${display.badge}`}>
          {display.label}
        </span>
      </div>

      <p className="mt-3 text-base leading-relaxed">{review.message}</p>

      {changes.length > 0 && (
        <ul className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm font-medium dark:bg-violet-950/30">
          {changes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}

      {detailed && (
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <Stat
            label="Avg weight"
            value={review.avg_weight_kg === null ? "—" : `${review.avg_weight_kg} kg`}
            hint={review.prev_avg_weight_kg === null ? undefined : `was ${review.prev_avg_weight_kg}`}
          />
          <Stat
            label="Loss rate"
            value={review.loss_rate_pct === null ? "—" : pct(review.loss_rate_pct)}
            hint={`goal ${LOSS_ON_TRACK_MIN_PCT}–${LOSS_ON_TRACK_MAX_PCT}%`}
          />
          <Stat label="Adherence" value={pct(review.adherence_pct, 0)} hint="goal 80%+" />
        </dl>
      )}
    </article>
  );
}

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const params = await searchParams;
  const asOf = typeof params.asOf === "string" ? params.asOf : null;

  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  // Review any finished weeks that haven't been reviewed yet (no cron needed).
  await runPendingReviews(supabase, userId, resolveToday(profile.timezone, asOf));

  const [{ data: reviewRows }, { data: targets }] = await Promise.all([
    supabase
      .from("weekly_reviews")
      .select(REVIEW_COLUMNS)
      .order("week_start", { ascending: false })
      .limit(60),
    supabase.from("profiles").select("calorie_target, step_target, protein_target_g").maybeSingle(),
  ]);

  const reviews = (reviewRows ?? []).map(normalizeReview);
  const [latest, ...older] = reviews;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Weekly review</h1>

      {targets && (
        <dl className="grid grid-cols-3 gap-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
          <Stat label="Calories" value={kcal(targets.calorie_target)} />
          <Stat label="Protein" value={`${targets.protein_target_g} g`} />
          <Stat label="Steps" value={targets.step_target === null ? "—" : kcal(targets.step_target)} />
        </dl>
      )}

      {!latest ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Your first review appears once you&apos;ve finished a full week (Monday to Sunday) of logging.
          Weigh in most mornings and the app does the rest.
        </p>
      ) : (
        <>
          <ReviewCard review={latest} detailed />
          {older.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-zinc-500">Earlier weeks</h2>
              <ul className="flex flex-col gap-2">
                {older.map((r) => (
                  <li key={r.week_start}>
                    <details className="rounded-2xl border border-zinc-200 px-4 dark:border-zinc-800">
                      <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3">
                        <span className="font-medium">{formatShortDate(r.week_start)}</span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${OUTCOME_DISPLAY[r.outcome].badge}`}
                        >
                          {OUTCOME_DISPLAY[r.outcome].label}
                        </span>
                      </summary>
                      <div className="pb-4">
                        <ReviewCard review={r} detailed />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
