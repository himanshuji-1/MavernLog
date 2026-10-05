import { Skeleton } from "@/components/skeleton";

export default function ProgressLoading() {
  return (
    <div role="status" aria-label="Loading progress" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-72 w-full" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
