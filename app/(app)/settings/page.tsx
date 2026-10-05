import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Signed in as {data.user?.email ?? "unknown"}
      </p>

      <Link
        href="/settings/exercises"
        className="mt-6 flex min-h-14 items-center justify-between rounded-xl border border-zinc-200 px-4 font-medium active:bg-zinc-50 dark:border-zinc-800 dark:active:bg-zinc-900"
      >
        Exercises
        <span aria-hidden="true" className="text-zinc-400">
          ›
        </span>
      </Link>

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="h-12 w-full rounded-xl border border-zinc-300 text-base font-medium active:scale-[0.98] dark:border-zinc-700"
        >
          Sign out
        </button>
      </form>
    </section>
  );
}
