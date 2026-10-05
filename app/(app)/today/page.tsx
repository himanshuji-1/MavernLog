import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isWithinLastDays, wellbeingTargetWeek } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { resolveToday } from "@/lib/today";
import { DailyLogCard } from "./daily-log-card";
import { DateSwitcher } from "./date-switcher";
import { WellbeingCard } from "./wellbeing-card";

const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const params = await searchParams;
  const asOf = first(params.asOf);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, start_weight_kg")
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const today = resolveToday(profile.timezone, asOf);
  const requested = first(params.date);
  const date = requested && isWithinLastDays(requested, today, 7) ? requested : today;
  const checkinWeek = wellbeingTargetWeek(today);

  const [logResult, lastWeightResult, checkinResult] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("bodyweight_kg, steps, sleep_hours, diet_followed, hunger, updated_at")
      .eq("log_date", date)
      .maybeSingle(),
    // Most recent weigh-in on or before the viewed day, to prefill the field.
    supabase
      .from("daily_logs")
      .select("bodyweight_kg")
      .not("bodyweight_kg", "is", null)
      .lte("log_date", date)
      .order("log_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    checkinWeek
      ? supabase
          .from("wellbeing_checkins")
          .select("id")
          .eq("week_start", checkinWeek)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const log = logResult.data;
  const fallbackWeight = lastWeightResult.data?.bodyweight_kg ?? profile.start_weight_kg;
  const showCheckin = checkinWeek !== null && !checkinResult.data;

  return (
    <div className="flex flex-col gap-4">
      <DateSwitcher date={date} today={today} asOf={asOf} />
      {showCheckin && <WellbeingCard asOf={asOf} />}
      <DailyLogCard
        // Re-mount after each save so the card returns to its "Logged ✓" summary.
        key={`${date}:${log?.updated_at ?? "new"}`}
        date={date}
        existing={log}
        fallbackWeight={fallbackWeight}
        asOf={asOf}
      />
    </div>
  );
}
