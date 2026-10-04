import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Signed in as {data.user?.email ?? "unknown"}
      </p>

      <p className="mt-6 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
        Targets and exercise list editing arrive in Phase 3.
      </p>

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
