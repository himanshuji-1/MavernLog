import { Placeholder } from "@/components/placeholder";
import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("calorie_target, protein_target_g, start_weight_kg, goal_weight_kg")
    .maybeSingle();

  return (
    <Placeholder title="Today" phase={2}>
      {profile && (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {[
            ["Calories", `${profile.calorie_target.toLocaleString()} kcal`],
            ["Protein", `${profile.protein_target_g} g`],
            ["Start", `${profile.start_weight_kg} kg`],
            ["Goal", `${profile.goal_weight_kg} kg`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Placeholder>
  );
}
