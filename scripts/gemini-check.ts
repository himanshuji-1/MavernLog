/**
 * One-off smoke test of the real Gemini API with YOUR key.
 *
 *   npm run gemini:check
 *
 * Sends two sample sentences through the exact same code the app uses and
 * prints what came back. Nothing is saved anywhere. It never prints the key.
 */

import { callGemini, DEFAULT_GEMINI_MODEL } from "../lib/ai/gemini";
import {
  QUICK_LOG_SYSTEM_PROMPT,
  buildConfirmDraft,
  buildQuickLogPrompt,
  geminiResponseSchema,
  parseJsonReply,
} from "../lib/ai/quicklog";
import { DEFAULT_EXERCISES } from "../lib/default-exercises";

const today = new Date().toISOString().slice(0, 10);
const exercises = DEFAULT_EXERCISES.map((e, i) => ({ id: `id-${i}`, name: e.name }));
let failures = 0;

function check(name: string, pass: boolean, detail = "") {
  console.log(`${pass ? "  ✓" : "  ✗"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!pass) failures++;
}

async function run(sentence: string) {
  console.log(`\n"${sentence}"`);
  const reply = await callGemini({
    system: QUICK_LOG_SYSTEM_PROMPT,
    prompt: buildQuickLogPrompt({ text: sentence, today, exerciseNames: exercises.map((e) => e.name) }),
    jsonSchema: geminiResponseSchema(),
  });
  check("Gemini answered", reply.ok, reply.ok ? "" : `${reply.code}: ${reply.message}`);
  if (!reply.ok) return null;

  const raw = parseJsonReply(reply.text);
  check("reply is valid JSON", raw !== null);
  const result = buildConfirmDraft(raw, { today, exercises });
  check("reply matches the strict schema", result.ok);
  if (!result.ok) {
    console.log("  raw reply:", reply.text.slice(0, 400));
    return null;
  }
  console.log("  draft:", JSON.stringify(result.draft));
  return result;
}

// Wrapped in a function: this project compiles scripts as CommonJS, which has no top-level await.
async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // fall back to the real environment
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("\n✗ GEMINI_API_KEY is not set. Add it to .env.local first.\n");
    process.exit(1);
  }

  console.log(`Model: ${process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL}`);

  const a = await run(
    "Weighed 84.2 this morning, slept 7 hours, about 9k steps, diet mostly on, hunger 3. Bench 3 sets of 5 at 62.5, last one RIR 1.",
  );
  if (a) {
    const d = a.draft;
    check("weight 84.2", d.daily.bodyweight_kg?.value === "84.2");
    check("steps 9000", d.daily.steps?.value === "9000");
    check("sleep 7", Number(d.daily.sleep_hours?.value) === 7);
    check("diet = mostly", d.daily.diet_followed?.value === "mostly");
    check("hunger 3", d.daily.hunger?.value === "3");
    check("3 bench sets", d.sets.length === 3 && d.sets.every((s) => s.exercise_id !== ""), `${d.sets.length} sets`);
    check("RIR only on the last set", d.sets[2]?.rir.value === "1" && d.sets[0]?.rir.value === "");
  }

  const b = await run("I had pizza");
  if (b) check("nothing to log", b.isEmpty);

  console.log(failures === 0 ? "\n✓ All checks passed.\n" : `\n✗ ${failures} check(s) failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\n✗ Unexpected error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
