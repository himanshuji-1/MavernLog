import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const userId = await getUserId(supabase);
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .maybeSingle();
  if (profile) redirect("/today");

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Welcome to MavernLog</h1>
      <p className="mb-8 mt-2 text-zinc-600 dark:text-zinc-400">
        Five quick numbers so the app can set your targets. You can change them
        later.
      </p>
      <OnboardingForm />
    </main>
  );
}
