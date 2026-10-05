/** Pulsing placeholder block for loading states. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800 ${className}`}
    />
  );
}
