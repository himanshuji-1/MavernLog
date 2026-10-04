import { GoogleButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">MavernLog</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          You log it. The app decides what&apos;s next.
        </p>
      </div>

      <GoogleButton />

      {error && (
        <p role="alert" className="text-center text-sm text-red-600">
          Sign-in didn&apos;t complete. Please try again.
        </p>
      )}

      <p className="text-center text-xs text-zinc-500">
        No passwords. Your data is private to your Google account.
      </p>
    </main>
  );
}
