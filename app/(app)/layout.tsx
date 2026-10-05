import Link from "next/link";
import { redirect } from "next/navigation";
import { TabBar } from "@/components/tab-bar";
import { createClient, getUserId } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");

  // First login: no profile row yet → onboarding.
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between px-5 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
        <span className="text-lg font-bold tracking-tight">MavernLog</span>
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 active:bg-zinc-100 dark:active:bg-zinc-800"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
          </svg>
        </Link>
      </header>
      <main className="px-5 py-3">{children}</main>
      <TabBar />
    </div>
  );
}
