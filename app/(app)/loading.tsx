import { Skeleton } from "@/components/skeleton";

// Shown instantly while any tab's data loads.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
