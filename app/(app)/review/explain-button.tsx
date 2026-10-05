"use client";

import { useState } from "react";

type State = { phase: "idle" } | { phase: "loading" } | { phase: "done"; text: string } | { phase: "error"; message: string };

export function ExplainButton({ weekStart }: { weekStart: string }) {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function explain() {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/explain-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart }),
      });
      const data = (await res.json().catch(() => null)) as { text?: string; error?: { message: string } } | null;
      if (res.ok && data?.text) setState({ phase: "done", text: data.text });
      else setState({ phase: "error", message: data?.error?.message ?? "Couldn't get an explanation right now." });
    } catch {
      setState({ phase: "error", message: "Couldn't reach the server." });
    }
  }

  return (
    <div className="mt-3">
      {state.phase === "done" ? (
        <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">In plain words</p>
          <p className="mt-1 whitespace-pre-wrap text-base leading-relaxed">{state.text}</p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            AI-written explanation. The message above is the app&apos;s actual decision.
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={explain}
            disabled={state.phase === "loading"}
            className="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 px-4 text-sm font-medium active:scale-95 disabled:opacity-60 dark:border-zinc-700"
          >
            {state.phase === "loading" ? "Explaining…" : "Explain this"}
          </button>
          {state.phase === "error" && (
            <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {state.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
