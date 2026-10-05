"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useSpeechInput } from "@/components/use-speech-input";
import { DAILY_KEYS, type ConfirmDraft, type DailyKey, type DateOption, type DraftField } from "@/lib/ai/quicklog";
import { saveQuickLog } from "./quick-log-actions";

// ---- labels
const DAILY_LABELS: Record<DailyKey, { label: string; unit?: string; mode: "decimal" | "numeric" | "select" }> = {
  bodyweight_kg: { label: "Bodyweight", unit: "kg", mode: "decimal" },
  steps: { label: "Steps", mode: "numeric" },
  sleep_hours: { label: "Sleep", unit: "hours", mode: "decimal" },
  diet_followed: { label: "Diet followed", mode: "select" },
  hunger: { label: "Hunger (1–5)", mode: "select" },
};

const input =
  "h-12 w-full rounded-xl border bg-white px-3 text-base outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-zinc-900";
const ok = "border-zinc-300 dark:border-zinc-700 focus:border-emerald-600";
const flag = "border-amber-500 bg-amber-50 dark:bg-amber-950/30 focus:border-amber-500";

/** Select options, plus the current value if it isn't a valid choice, so a flagged "7" stays visible. */
function withCurrent(base: string[], current: string): { value: string; label: string }[] {
  const options = base.map((b) => ({ value: b, label: b }));
  if (current !== "" && !base.includes(current)) options.push({ value: current, label: `${current} (not valid)` });
  return options;
}

type Phase = "idle" | "parsing" | "confirm" | "empty" | "done";

function Note({ text, flagged }: { text?: string; flagged?: boolean }) {
  if (!text) return null;
  return (
    <p className={`mt-1 text-sm ${flagged ? "text-amber-800 dark:text-amber-300" : "text-red-600 dark:text-red-400"}`} role={flagged ? undefined : "alert"}>
      {text}
    </p>
  );
}

export function QuickLogCard({
  exercises,
  dates,
  asOf,
}: {
  exercises: { id: string; name: string }[];
  dates: DateOption[];
  asOf: string | null;
}) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<ConfirmDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [doneMessage, setDoneMessage] = useState("");
  const [saving, startSaving] = useTransition();

  // ---- voice: whatever was already typed stays, and the spoken sentence is added after it
  const baseText = useRef("");
  const onTranscript = useCallback((spoken: string) => setText(`${baseText.current}${spoken}`.slice(0, 500)), []);
  const speech = useSpeechInput(onTranscript);

  function toggleMic() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    baseText.current = text.trim() ? `${text.trim()} ` : "";
    speech.start();
  }

  // ---- parse
  async function parse() {
    setError(null);
    setFieldErrors({});
    setPhase("parsing");
    try {
      const res = await fetch("/api/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, as_of: asOf }),
      });
      const data = (await res.json().catch(() => null)) as
        | { draft: ConfirmDraft; isEmpty: boolean }
        | { error: { message: string } }
        | null;
      if (!res.ok || !data || "error" in data) {
        setError(data && "error" in data ? data.error.message : "Please sign in again, then retry.");
        setPhase("idle");
        return;
      }
      setDraft(data.draft);
      setPhase(data.isEmpty ? "empty" : "confirm");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setPhase("idle");
    }
  }

  function reset() {
    setPhase("idle");
    setDraft(null);
    setError(null);
    setFieldErrors({});
    setText("");
  }

  // ---- editing the draft (editing a field clears its "check this" highlight)
  function editDaily(key: DailyKey, value: string) {
    setDraft((d) => d && { ...d, daily: { ...d.daily, [key]: { value, flagged: false } } });
    setFieldErrors((f) => ({ ...f, [`daily.${key}`]: "" }));
  }
  function editSet(i: number, patch: Partial<Record<"weight_kg" | "reps" | "rir", string>> & { exercise_id?: string }) {
    setDraft(
      (d) =>
        d && {
          ...d,
          sets: d.sets.map((s, idx) => {
            if (idx !== i) return s;
            const next = { ...s };
            if (patch.exercise_id !== undefined) {
              next.exercise_id = patch.exercise_id;
              next.exercise_flag = undefined;
            }
            for (const f of ["weight_kg", "reps", "rir"] as const) {
              if (patch[f] !== undefined) next[f] = { value: patch[f], flagged: false };
            }
            return next;
          }),
        },
    );
    setFieldErrors((f) => {
      const copy = { ...f };
      for (const k of Object.keys(patch)) copy[`sets.${i}.${k}`] = "";
      return copy;
    });
  }
  function removeSet(i: number) {
    setDraft((d) => d && { ...d, sets: d.sets.filter((_, idx) => idx !== i) });
    setFieldErrors({});
  }

  // ---- save (only ever on an explicit tap)
  function save() {
    if (!draft) return;
    setError(null);
    startSaving(async () => {
      const daily: Partial<Record<DailyKey, string>> = {};
      for (const key of DAILY_KEYS) {
        const f = draft.daily[key];
        if (f) daily[key] = f.value;
      }
      const result = await saveQuickLog({
        date: draft.date,
        as_of: asOf,
        daily,
        sets: draft.sets.map((s) => ({
          exercise_id: s.exercise_id,
          weight_kg: s.weight_kg.value,
          reps: s.reps.value,
          rir: s.rir.value,
        })),
      });
      if (result.ok) {
        const parts = [
          result.saved.daily ? "daily log" : null,
          result.saved.sets ? `workout (${result.saved.sets} set${result.saved.sets === 1 ? "" : "s"})` : null,
        ].filter(Boolean);
        setDoneMessage(`Saved your ${parts.join(" and ")}.`);
        setPhase("done");
        setDraft(null);
        setText("");
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.message ?? (result.fieldErrors ? "Fix the highlighted fields, then save again." : "Couldn't save."));
      }
    });
  }

  // ---- views
  const dateLabel = dates.find((d) => d.value === draft?.date)?.label ?? draft?.date ?? "";

  if (phase === "done") {
    return (
      <section className="rounded-2xl border border-emerald-600/40 bg-emerald-50 p-4 dark:bg-emerald-950/30">
        <p role="status" className="font-semibold">
          {doneMessage} ✓
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-3 h-11 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
        >
          Log something else
        </button>
      </section>
    );
  }

  if (phase === "empty" && draft) {
    return (
      <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-semibold">Nothing to log</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          I didn&apos;t find anything I can log in that. Try a weight, steps, sleep, how your diet went, or sets you lifted.
        </p>
        {draft.unclear.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            {draft.unclear.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        )}
        <button type="button" onClick={reset} className="mt-3 h-11 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700">
          Try again
        </button>
      </section>
    );
  }

  if (phase === "confirm" && draft) {
    const dailyKeys = DAILY_KEYS.filter((k) => draft.daily[k]);
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-amber-500/60 p-4" aria-label="Confirm quick log">
        <div>
          <h2 className="font-semibold">Check this before saving</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Nothing is saved until you tap Save. Highlighted fields need a look.
          </p>
        </div>

        {draft.unclear.length > 0 && (
          <div className="rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
            <p className="font-medium">I couldn&apos;t use:</p>
            <ul className="list-disc pl-5">
              {draft.unclear.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label htmlFor="ql-date" className="mb-1.5 block text-sm font-medium">
            Day
          </label>
          <select
            id="ql-date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value, date_flag: undefined })}
            className={`${input} ${draft.date_flag || fieldErrors.date ? flag : ok}`}
          >
            {dates.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <Note text={fieldErrors.date || draft.date_flag} flagged={!fieldErrors.date} />
        </div>

        {dailyKeys.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              Daily log for {dateLabel}
            </h3>
            {dailyKeys.map((key) => {
              const f = draft.daily[key] as DraftField;
              const meta = DAILY_LABELS[key];
              const err = fieldErrors[`daily.${key}`];
              const bad = f.flagged || Boolean(err);
              return (
                <div key={key}>
                  <label htmlFor={`ql-${key}`} className="mb-1.5 block text-sm font-medium">
                    {meta.label}
                    {meta.unit && <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">({meta.unit})</span>}
                  </label>
                  {meta.mode === "select" ? (
                    <select
                      id={`ql-${key}`}
                      value={f.value}
                      onChange={(e) => editDaily(key, e.target.value)}
                      className={`${input} ${bad ? flag : ok}`}
                    >
                      <option value="">—</option>
                      {withCurrent(key === "diet_followed" ? ["yes", "mostly", "no"] : ["1", "2", "3", "4", "5"], f.value).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`ql-${key}`}
                      type="text"
                      inputMode={meta.mode}
                      value={f.value}
                      onChange={(e) => editDaily(key, e.target.value)}
                      className={`${input} ${bad ? flag : ok}`}
                    />
                  )}
                  <Note text={err || f.note} flagged={!err} />
                </div>
              );
            })}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Anything already logged for that day and not shown here stays as it is.
            </p>
          </div>
        )}

        {draft.sets.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              Workout for {dateLabel}
            </h3>
            {draft.sets.map((s, i) => {
              const exErr = fieldErrors[`sets.${i}.exercise_id`];
              return (
                <div key={i} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">Set {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeSet(i)}
                      aria-label={`Remove set ${i + 1}`}
                      className="h-11 rounded-lg px-3 text-sm font-medium text-red-600 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </div>

                  <label htmlFor={`ql-ex-${i}`} className="mb-1.5 block text-sm font-medium">
                    Exercise
                  </label>
                  <select
                    id={`ql-ex-${i}`}
                    value={s.exercise_id}
                    onChange={(e) => editSet(i, { exercise_id: e.target.value })}
                    className={`${input} ${s.exercise_flag || exErr ? flag : ok}`}
                  >
                    <option value="">Pick an exercise…</option>
                    {exercises.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  <Note text={exErr || s.exercise_flag} flagged={!exErr} />

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(
                      [
                        ["weight_kg", "Weight (kg)", "decimal"],
                        ["reps", "Reps", "numeric"],
                        ["rir", "RIR", "numeric"],
                      ] as const
                    ).map(([field, label, mode]) => {
                      const f = s[field];
                      const err = fieldErrors[`sets.${i}.${field}`];
                      const bad = f.flagged || Boolean(err);
                      return (
                        <div key={field}>
                          <label htmlFor={`ql-${field}-${i}`} className="mb-1.5 block text-xs font-medium">
                            {label}
                          </label>
                          {field === "rir" ? (
                            <select
                              id={`ql-${field}-${i}`}
                              value={f.value}
                              onChange={(e) => editSet(i, { rir: e.target.value })}
                              className={`${input} ${bad ? flag : ok}`}
                            >
                              <option value="">—</option>
                              {withCurrent(["0", "1", "2", "3", "4", "5"], f.value).map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={`ql-${field}-${i}`}
                              type="text"
                              inputMode={mode}
                              value={f.value}
                              onChange={(e) => editSet(i, { [field]: e.target.value })}
                              className={`${input} ${bad ? flag : ok}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {(["weight_kg", "reps", "rir"] as const).map((field) => (
                    <Note key={field} text={fieldErrors[`sets.${i}.${field}`] || s[field].note} flagged={!fieldErrors[`sets.${i}.${field}`]} />
                  ))}
                </div>
              );
            })}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Saved as one finished workout, and it counts towards your next targets.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            className="h-12 flex-1 rounded-xl border border-zinc-300 text-base font-medium dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="h-12 flex-[2] rounded-xl bg-emerald-700 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>
    );
  }

  // idle / parsing
  const busy = phase === "parsing";
  return (
    <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-semibold">Quick log</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Say or type one sentence. You&apos;ll confirm before anything is saved.
      </p>

      <label htmlFor="quick-log-text" className="sr-only">
        Describe your day or workout
      </label>
      <textarea
        id="quick-log-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder={speech.listening ? "Listening…" : "e.g. Weighed 84.2 this morning, slept 7 hours, about 9k steps, diet mostly on"}
        className="mt-3 w-full resize-none rounded-xl border border-zinc-300 bg-white p-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 dark:border-zinc-700 dark:bg-zinc-900"
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {speech.supported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={busy}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? "Stop listening" : "Speak"}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-xl transition active:scale-95 ${
              speech.listening
                ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            <span aria-hidden="true">{speech.listening ? "■" : "🎤"}</span>
          </button>
        )}
        <button
          type="button"
          onClick={parse}
          disabled={busy || speech.listening || text.trim() === ""}
          className="h-12 flex-1 rounded-xl bg-emerald-700 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Reading…" : "Review"}
        </button>
      </div>
      {speech.listening && (
        <p role="status" className="mt-2 flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          Listening… speak your sentence. It stops by itself when you pause.
        </p>
      )}
      {speech.error && (
        <p role="alert" className="mt-2 text-sm text-amber-800 dark:text-amber-300">
          {speech.error}
        </p>
      )}
      {!speech.supported && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Tip: tap the microphone on your keyboard to dictate.
        </p>
      )}
    </section>
  );
}
