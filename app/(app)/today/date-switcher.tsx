import Link from "next/link";
import { addDays, formatShortDate } from "@/lib/dates";

function href(date: string, today: string, asOf: string | null) {
  const params = new URLSearchParams();
  if (date !== today) params.set("date", date);
  if (asOf) params.set("asOf", asOf);
  const qs = params.toString();
  return qs ? `/today?${qs}` : "/today";
}

export function DateSwitcher({
  date,
  today,
  asOf,
}: {
  date: string;
  today: string;
  asOf: string | null;
}) {
  const earliest = addDays(today, -6);
  const prev = date > earliest ? addDays(date, -1) : null;
  const next = date < today ? addDays(date, 1) : null;

  const arrow =
    "flex h-11 w-11 items-center justify-center rounded-full text-2xl active:bg-zinc-100 dark:active:bg-zinc-800";
  const disabled = "flex h-11 w-11 items-center justify-center text-2xl text-zinc-300 dark:text-zinc-700";

  return (
    <div className="flex items-center justify-between">
      {prev ? (
        <Link href={href(prev, today, asOf)} aria-label="Previous day" className={arrow}>
          ‹
        </Link>
      ) : (
        <span aria-hidden="true" className={disabled}>
          ‹
        </span>
      )}
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">
          {date === today ? "Today" : formatShortDate(date)}
        </h1>
        {date === today && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatShortDate(date)}</p>
        )}
      </div>
      {next ? (
        <Link href={href(next, today, asOf)} aria-label="Next day" className={arrow}>
          ›
        </Link>
      ) : (
        <span aria-hidden="true" className={disabled}>
          ›
        </span>
      )}
    </div>
  );
}
