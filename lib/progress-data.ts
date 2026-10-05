import type { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/paginate";
import type { WeightPoint } from "@/lib/progress";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Every weigh-in the user has ever logged, oldest first. */
export async function loadWeights(supabase: Supabase): Promise<WeightPoint[]> {
  const rows = await fetchAll<{ log_date: string; bodyweight_kg: number | string }>(
    (from, to) =>
      supabase
        .from("daily_logs")
        .select("log_date, bodyweight_kg")
        .not("bodyweight_kg", "is", null)
        .order("log_date")
        .range(from, to) as unknown as PromiseLike<{
        data: { log_date: string; bodyweight_kg: number | string }[] | null;
        error: unknown;
      }>,
  );
  return rows.map((r) => ({ date: r.log_date, kg: Number(r.bodyweight_kg) }));
}
