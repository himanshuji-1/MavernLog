import type { Metadata } from "next";
import { GoogleButton } from "./google-button";
import { HeroGraphic } from "./hero-graphic";

export const metadata: Metadata = {
  title: { absolute: "MavernLog · The fitness log that makes the call" },
  description:
    "Log your day in under a minute. Plain, transparent rules set your next lift, adjust your calories every week, and tell you when to ease off.",
};

const DIFFERENCES = [
  {
    title: "It decides. You don't guess.",
    body: "Your next weight, your weekly calories and your step target are worked out from what you log. Open the app and the answer is waiting.",
    icon: "M13 2 3 14h9l-1 8 10-12h-9l1-8Z",
  },
  {
    title: "Rules, not a black box.",
    body: "Every change comes with its reason. The maths is plain code you could check by hand. AI only turns your voice into numbers, and you confirm them.",
    icon: "M9 12l2 2 4-4M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4Z",
  },
  {
    title: "Kind by design.",
    body: "Never below 1,800 kcal. Losing too fast? It slows you down. Running on empty two weeks in a row? It suggests a break, not more effort.",
    icon: "M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z",
  },
];

const STEPS = [
  { n: "1", title: "Log", body: "Weight, steps, sleep, diet, hunger. Tap, or just say it in one sentence." },
  { n: "2", title: "Lift", body: "Your target for every exercise is ready before you start. Log each set in a tap." },
  { n: "3", title: "Review", body: "Each week the app checks your progress and adjusts the plan, or leaves it alone." },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Background: soft moving glow + faint grid */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-emerald-400/25 blur-3xl motion-safe:animate-drift dark:bg-emerald-500/20" />
        <div
          className="absolute -right-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-teal-300/25 blur-3xl motion-safe:animate-drift dark:bg-teal-600/15"
          style={{ animationDelay: "-9s" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(113_113_122/0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgb(113_113_122/0.08)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center gap-2.5 px-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-lg font-extrabold text-emerald-400 dark:bg-zinc-800" aria-hidden="true">
          M
        </span>
        <span className="text-lg font-bold tracking-tight">MavernLog</span>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16">
        {/* ---- Hero */}
        <section className="grid items-center gap-8 pt-10 lg:grid-cols-2 lg:gap-12 lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-800 motion-safe:animate-fade-up dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              The fitness log that makes the call
            </p>

            <h1
              className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight motion-safe:animate-fade-up sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "0.1s" }}
            >
              Charts tell you what happened.{" "}
              <span className="bg-linear-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300">
                MavernLog tells you what&apos;s next.
              </span>
            </h1>

            <p
              className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-600 motion-safe:animate-fade-up dark:text-zinc-400"
              style={{ animationDelay: "0.2s" }}
            >
              Log your day in under a minute. Plain, transparent rules set your next lift, adjust your calories each week,
              and tell you when to ease off. No guesswork, no streak guilt.
            </p>

            <div className="mt-8 max-w-sm motion-safe:animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <GoogleButton />
              {error && (
                <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
                  Sign-in didn&apos;t complete. Please try again.
                </p>
              )}
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Free. No passwords. Your data is private to your account.
              </p>
            </div>
          </div>

          <div className="motion-safe:animate-fade-up" style={{ animationDelay: "0.25s" }}>
            <HeroGraphic />
            <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">Example of what the app shows you</p>
          </div>
        </section>

        {/* ---- What makes it different */}
        <section className="mt-20" aria-labelledby="different">
          <h2 id="different" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Most apps count. This one coaches.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {DIFFERENCES.map((d) => (
              <article
                key={d.title}
                className="rounded-2xl border border-zinc-200 bg-white/70 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <Icon d={d.icon} />
                </span>
                <h3 className="mt-4 font-semibold">{d.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{d.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---- A minute a day */}
        <section className="mt-16" aria-labelledby="minute">
          <h2 id="minute" className="text-2xl font-bold tracking-tight sm:text-3xl">
            A minute a day. That&apos;s the deal.
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 font-bold text-emerald-400 dark:bg-zinc-800">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- Final call to action */}
        <section className="mt-16 rounded-3xl bg-zinc-950 p-8 text-center text-white sm:p-12 dark:bg-zinc-900">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Stop guessing your next set.</h2>
          <p className="mx-auto mt-2 max-w-md text-zinc-300">Sign in, answer five quick questions, and the app takes it from there.</p>
          <div className="mx-auto mt-6 max-w-sm">
            <GoogleButton />
          </div>
        </section>
      </main>
    </div>
  );
}
