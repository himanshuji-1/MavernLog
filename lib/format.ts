import type { Target } from "@/lib/engine/progression";

/** 62.5 → "62.5 kg", 60 → "60 kg" */
export function formatKg(n: number): string {
  return `${Number(n.toFixed(2))} kg`;
}

/** "62.5 kg × 3 × 5", or the sets × reps alone when there's no starting weight yet. */
export function formatTarget(t: Pick<Target, "weight_kg" | "sets" | "reps">): string {
  const scheme = `${t.sets} × ${t.reps}`;
  return t.weight_kg === null ? `Pick a start weight · ${scheme}` : `${formatKg(t.weight_kg)} × ${scheme}`;
}
