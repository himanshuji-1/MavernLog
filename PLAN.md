# MavernLog — Build Plan

> The user logs. The app decides.

A mobile-first fitness progression web app. Users log bodyweight, daily habits and workout sets; plain, tested code decides next session's weights and weekly diet adjustments. Gemini only turns spoken sentences into structured data and explains the decisions. It never does the maths.

**Status:** Phases 1–2 done and committed. Phase 3 built; waiting for your checks and okay. Phases 4–6 not started.

**Phase 1 notes (deviations from the plan above):**
- Next 16 renamed `middleware` to `proxy`, so the file is `proxy.ts`. It refreshes the session and sends signed-out users to `/login`.
- The "not onboarded yet → `/onboarding`" check runs in the `(app)` layout instead of the proxy, because it needs a database query.
- Onboarding requires goal weight below current weight (the engine is built around fat loss).

**Phase 2 notes:** the wellbeing check-in also shows on Monday for the week that just ended (grace day for a missed Sunday).

**Phase 3 notes:**
- A session only counts as a "hit" if all of the exercise's target sets were logged, as well as every set reaching the target reps at RIR ≤ 2. Fewer sets logged → hold the weight.
- "Working weight" = the heaviest set of the last session.
- The deload rounds *down* to 2.5 kg, so it can be a bit more than 7% (e.g. 40 kg → 35 kg).
- History used for targets covers the last 120 days.

---

## 0. Ground rules

### Stack
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript (strict) |
| Styling | Tailwind CSS, mobile-first (designed at 390px width, works up to desktop) |
| Auth | Supabase Auth, **Continue with Google only**, no passwords |
| Database | Supabase Postgres, migrations kept in `supabase/migrations/` |
| Hosting | Vercel (preview deploy per branch, production from `main`) |
| Validation | Zod: every form, every server action, every Gemini response |
| Charts | Recharts |
| Tests | Vitest for the engine (pure functions, no database) |
| AI parsing | Gemini (current Flash model), structured JSON output, called only from the server |

### Non-negotiables
1. **Every table has `user_id`** referencing `auth.users(id)`, with **row-level security enabled** and select, insert, update and delete policies of `user_id = auth.uid()`. No exceptions. Exercise lists are per user, not global.
2. **The engine is pure TypeScript** in `lib/engine/`: no Supabase, no `fetch`, no AI, no `Date.now()` (today's date is passed in). That keeps it fully unit-testable.
3. **The engine never suggests fewer than 1,800 kcal.** It's enforced with a clamp in one place and covered by tests.
4. **Gemini never decides.** It returns a draft. The user confirms. Saving goes through the same validated server actions as the manual forms.
5. **Secrets stay on the server.** The Gemini key and the Supabase service-role key are never sent to the browser. The service-role key is used only by the seed script, locally.
6. **Metric units** (kg, cm) throughout.

### Planned folder layout
```
app/
  login/                 Continue with Google
  auth/callback/         OAuth code exchange
  onboarding/            first-login profile form
  (app)/                 signed-in shell with bottom tab bar
    today/               home: daily log, quick log, wellbeing prompt
    workout/             next targets → set logging
    review/              weekly review
    progress/            charts
    settings/            targets, exercises, sign out
  api/quick-log/         Gemini parse endpoint
lib/
  engine/                pure logic + __tests__/
  supabase/              browser + server clients (@supabase/ssr)
  validation/            Zod schemas shared by forms, actions, Gemini
supabase/migrations/     SQL schema + RLS
scripts/seed.ts          8 weeks of fake data
```

### Definition of done (every phase)
- `npm run lint` and `npm run typecheck` are clean
- `npm test` passes (from Phase 3 onward)
- Pushed to a branch, and the Vercel preview builds and works **on your phone**
- You run the phase's checks and give the okay. Then we commit and merge to `main`

> **Testing on the phone:** Google OAuth won't redirect to a LAN IP like `192.168.x.x`, so test phone behaviour on the **Vercel preview URL**, not on `npm run dev`.

---

## 1. Data model

All tables: `id uuid pk default gen_random_uuid()` (except `profiles`), `user_id uuid not null references auth.users on delete cascade`, `created_at timestamptz default now()`, plus RLS as above.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `user_id` (PK), `height_cm`, `start_weight_kg`, `goal_weight_kg`, `calorie_target`, `protein_target_g`, `step_target` (nullable), `timezone`, `onboarded_at` | One row per user. Timezone is read from the browser at onboarding |
| `daily_logs` | `log_date date`, `bodyweight_kg`, `steps`, `sleep_hours`, `diet_followed` enum `yes / mostly / no`, `hunger` 1–5 | `unique(user_id, log_date)`, saved as an upsert. All fields except the date are optional |
| `exercises` | `name`, `body_region` enum `upper / lower`, `target_sets`, `target_reps`, `archived` | Default list copied in at onboarding. User can add, edit and archive |
| `workout_sessions` | `performed_on date`, `started_at`, `finished_at` | |
| `workout_sets` | `session_id`, `exercise_id`, `set_number`, `weight_kg`, `reps`, `rir` 0–5 | `user_id` duplicated here so RLS stays a one-line check |
| `wellbeing_checkins` | `week_start date`, `mood`, `energy`, `motivation` (1–5 each) | `unique(user_id, week_start)` |
| `weekly_reviews` | `week_start`, `avg_weight_kg`, `loss_rate_pct`, `adherence_pct`, `outcome`, `ladder_rung`, `calorie_target_after`, `step_target_after`, `message`, `inputs jsonb` | One per completed week. A stored record of every decision and the numbers behind it |

**Weeks** run Monday to Sunday in the user's timezone.
**Next workout targets are computed from history, not stored**, so they always match what was actually lifted.

---

## 2. Engine rules (the source of truth for tests)

### 2.1 e1RM (Epley)
`e1RM = weight × (1 + reps / 30)`. When `reps = 1`, e1RM = weight. Per session, an exercise's e1RM is its **best set**. It drives the strength chart.

### 2.2 Workout progression (per exercise, for the next session)
A session **hits** when every working set reaches `target_reps` at RIR ≤ 2. It **misses** when any working set falls short of `target_reps`.

| Situation | Next target |
|---|---|
| No history | Ask for a starting weight. No suggestion |
| Last session hit, upper body | last weight **+ 2.5 kg** |
| Last session hit, lower body | last weight **+ 5 kg** |
| Missed in **2 sessions in a row** | last weight **× 0.93** (about −7%), rounded down to the nearest 2.5 kg. The miss streak then resets |
| Anything else (one miss, or reps hit at RIR > 2) | Same weight |

"Last weight" means the working weight used in the most recent session of that exercise. Output: `{ weight, sets, reps, reason }`. The reason is shown on the target card, for example *"Hit 3×8 at RIR 2 → +2.5 kg"*.

### 2.3 Weekly review
**Inputs:** the last 14 days of daily logs, the last 2 weekly check-ins, current targets, and previous reviews (to know the ladder rung).

- **7-day average weight** = mean of the logged weights that week
- **Loss rate %** = `(prev 7-day avg − this 7-day avg) / prev 7-day avg × 100`. **Target: 0.3–0.7% per week**
- **Adherence %** = diet score over 7 days: yes = 1, mostly = 0.5, no or not logged = 0
- **Not enough data:** fewer than 4 weight entries in either week → outcome `insufficient_data` with a "log a few more weigh-ins" message. Nothing changes

**Checked strictly in this order. The first match wins:**

1. **Safety**
   - Wellbeing low 2 weeks running (see 2.4) → **diet break**
   - Loss rate > 1.0%/week → too fast: **+150 kcal**
   - Current calorie target below 1,800 → raise to 1,800
2. **Adherence < 80%** → **simplify.** No target changes. The message names the single habit to focus on (the weakest one this week)
3. **On track** (0.3–0.7%) → **change nothing**
4. **Stalled** (loss < 0.3%, including gains, for **2 weeks in a row**) → **next rung on the strategy ladder**

**Strategy ladder** (one rung per stall, never below 1,800 kcal):
| Rung | Action |
|---|---|
| 1 | Step target = current 7-day average steps + 2,000 |
| 2 | Calories −150 |
| 3 | Step target +2,000 more |
| 4 | Calories −150 more |
| 5 (or a calorie cut blocked by the 1,800 floor) | Suggest a 1–2 week diet break, then restart the ladder at rung 1 |

**Final step on every outcome:** `calories = max(1800, calories)`, applied in a single function.

### 2.4 Wellbeing
Weekly check-in: mood, energy, motivation (1–5). **Low** = average of the three ≤ 2.0. **Low two weeks running** → suggest a diet break with a kind, non-judgemental message, for example *"You've been running on empty for two weeks. That's a signal, not a failure. A week at maintenance usually brings energy back and makes the next stretch easier."*

---

## 3. Phases

### Phase 1: Foundation, Google login, onboarding
**Goal:** a deployed, installable shell where a user signs in with Google, completes onboarding, and sees only their own data.

**You do (one-time setup, I'll walk you through it):**
- Create a Supabase project (a **dev** project. Production can come later)
- Create a Google Cloud OAuth client. Add the Supabase callback URL to it. Enable the Google provider in Supabase
- Create a Vercel project from this repo. Add the env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Add `http://localhost:3000/**` and your Vercel URLs to the Supabase redirect allow-list

**Build:**
- Next.js + TypeScript + Tailwind scaffold. Scripts: `lint`, `typecheck`, `test`
- Supabase clients via `@supabase/ssr`. Middleware that sends signed-out users to `/login` and users who haven't onboarded to `/onboarding`
- `/login` with one **Continue with Google** button. `/auth/callback`. Sign out in settings
- Migration 001: `profiles` + `exercises` with RLS
- `/onboarding`: height, weight, goal weight, calories, protein (Zod-validated, sensible ranges, a warning if calories are under 1,800). On save, copy in the default exercises:

  | Exercise | Region | Default sets × reps |
  |---|---|---|
  | Squat | lower | 3 × 5 |
  | Bench Press | upper | 3 × 5 |
  | Deadlift | lower | 1 × 5 |
  | Overhead Press | upper | 3 × 5 |
  | Barbell Row | upper | 3 × 8 |
  | Romanian Deadlift | lower | 3 × 8 |
  | Lat Pulldown | upper | 3 × 10 |
  | Leg Press | lower | 3 × 10 |

- App shell: bottom tab bar (Today · Workout · Review · Progress), with empty placeholder pages
- PWA manifest and icons so it can be added to the home screen

**Run:**
```bash
npm install
npm run dev
npx supabase db push
```

**Check:**
- [ ] `localhost:3000` redirects to `/login`. Google sign-in works. A first login lands on `/onboarding`
- [ ] Submitting onboarding takes you to Today. Signing out and in again skips onboarding
- [ ] In the Supabase SQL editor, run `select tablename, rowsecurity from pg_tables where schemaname = 'public';`. **Every row shows `true`**
- [ ] Sign in with a **second Google account** in a private window. It gets its own onboarding and sees no data from the first account
- [ ] On your phone, open the Vercel preview, sign in, and **Add to Home Screen**. It opens full-screen

---

### Phase 2: Daily log and wellbeing check-in
**Goal:** logging a day takes under a minute, one-handed.

**Build:**
- Migration 002: `daily_logs`, `wellbeing_checkins` with RLS
- Today screen with a **one-card daily log**:
  - Bodyweight prefilled with the last value, with ± 0.1 kg steppers and a numeric keypad
  - Steps (numeric) and sleep hours (± 0.5 stepper)
  - Diet followed: three big buttons, **Yes / Mostly / No**
  - Hunger: five tap targets, 1–5
  - One **Save** button. It upserts for today. A "Logged ✓" state appears with an Edit option
- Date switcher to fill in or edit the last 7 days
- Weekly wellbeing card: appears from Sunday until it's filled in for that week. Three 1–5 rows, then save
- Server actions with Zod validation

**Run:**
```bash
npx supabase db push
npm run dev
```

**Check:**
- [ ] Time yourself on the phone (Vercel preview): open the app → daily log saved in **under 60 seconds**
- [ ] Saving twice on the same day updates one row instead of creating duplicates (check the `daily_logs` table in Supabase)
- [ ] Out-of-range values such as hunger 7 or weight 0 are rejected with a clear message
- [ ] Edit yesterday's log through the date switcher. It saves to the correct date
- [ ] The wellbeing card appears on Sunday (temporarily change the device date or use the `?asOf=` dev override) and disappears once saved
- [ ] The second Google account still sees none of these rows

---

### Phase 3: Workout engine and workout logging
**Goal:** the app tells you what to lift. You log what you lifted.

**Build:**
- `lib/engine/e1rm.ts` and `lib/engine/progression.ts`, implementing rules 2.1 and 2.2 exactly
- **Unit tests** (`lib/engine/__tests__/`):
  - Epley: `epley(100, 5) ≈ 116.67`, `epley(100, 1) = 100`, best-set selection
  - Upper hit → +2.5. Lower hit → +5
  - All reps hit at RIR 3 → hold
  - One miss → hold. Miss, hit, miss → hold (not consecutive)
  - Two misses in a row → ×0.93 rounded down to 2.5 (100 kg → 92.5 kg). The streak resets after the drop
  - No history → "needs starting weight"
  - Only sets for the right exercise and session are considered. Sessions are sorted by date, not insert order
- Migration 003: `workout_sessions`, `workout_sets` with RLS
- **Workout tab:**
  1. **Before the workout:** a list of exercises, each with its **next-session target card** (weight × sets × reps + reason). Pick the exercises for today, or tap **Repeat last workout**
  2. **During the workout:** each set row is prefilled with the target weight and reps. Adjust with steppers, pick RIR (0–5), tap ✓. Big tap targets
  3. **Finish:** a summary with the e1RM for each exercise
- Settings → Exercises: add, edit (name, region, sets, reps) and archive

**Run:**
```bash
npm test
npx supabase db push
npm run dev
```

**Check:**
- [ ] `npm test` passes, and every rule in 2.2 has at least one test
- [ ] Log a Bench session at 60 kg, 3×5, RIR 2. The next Bench target shows **62.5 kg** with the reason
- [ ] Log a Squat session at 100 kg, 3×5, RIR 1. The next Squat target shows **105 kg**
- [ ] Log two Bench sessions in a row with a missed set. The next target drops about 7% and is rounded to 2.5 kg
- [ ] Logging a full workout on the phone feels quick, with no typing needed when you hit the target
- [ ] The second Google account sees none of these sessions

---

### Phase 4: Weekly review engine and seed data
**Goal:** every week the app reviews progress and adjusts targets in the agreed order, with test coverage and realistic data to prove it.

**Build:**
- `lib/engine/weeklyReview.ts` and `lib/engine/wellbeing.ts`, implementing 2.3 and 2.4. One `clampCalories()` used everywhere
- **Unit tests:**
  - 7-day average ignores missing days. Loss-rate maths
  - Adherence scoring (yes / mostly / no / missing)
  - **Order of precedence:** safety beats low adherence, which beats on track, which beats stalled. One test per step, plus "multiple conditions true → the earliest wins"
  - On track → targets unchanged
  - Stalled for 1 week → no change. Stalled for 2 weeks → next rung. Rungs advance 1 → 5, and a diet break restarts the ladder
  - **Calorie floor:** a loop over many starting targets and ladder positions, asserting the result is never below 1,800
  - Wellbeing low 1 week → nothing. Low 2 weeks → diet break with a kind message
  - Fewer than 4 weigh-ins → `insufficient_data`
- Migration 004: `weekly_reviews` with RLS
- **Review tab:** when opened, any completed weeks that haven't been reviewed are reviewed oldest first, then saved (no cron needed). It shows the latest review: outcome, the numbers behind it, the message, and the new targets. Older reviews are listed below. New targets are written to `profiles`
- **Seed script** `scripts/seed.ts`, run with `npm run seed -- --email you@gmail.com`:
  - Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. **Refuses to run unless `--confirm` is passed**, because it wipes and rewrites **that one user's** data
  - Seeded random, so the same data comes out every run
  - 8 weeks of daily logs: weight trending about 90 → 86.5 kg with day-to-day noise, a **2-week stall in weeks 5–6**, one **low-adherence week**, and **two low wellbeing check-ins** in weeks 7–8
  - 3 workouts a week on the default exercises with realistic progression, including one double miss
  - The user must have signed in once first, so their account exists

**Run:**
```bash
npm test
npx supabase db push
npm run seed -- --email you@gmail.com --confirm
npm run dev
```

**Check:**
- [ ] `npm test` passes. The precedence and 1,800 floor tests are present
- [ ] After seeding, the Review tab shows 8 reviews whose outcomes match the scenario: on track early, **simplify** in the low-adherence week, **ladder rung 1** after the stall, and a **diet break** at the end because of wellbeing
- [ ] No review anywhere shows a calorie target below 1,800
- [ ] The Workout tab's next targets reflect the seeded history, including the deload
- [ ] Running the seed again gives identical results

---

### Phase 5: Progress page and phone polish
**Goal:** you can see the trend at a glance.

**Build:**
- **Weight chart:** daily weigh-ins as dots, the 7-day average as a line, the goal weight as a dashed line. Range toggle: 4 weeks / 8 weeks / all
- **Strength chart:** an exercise picker, with best e1RM per session over time
- Summary tiles: current 7-day average, total lost, average weekly loss rate, distance to goal
- Polish: loading skeletons, empty states with a "log your first…" prompt, a check that every tap target is at least 44px, dark mode, safe-area padding for iPhone notches

**Run:**
```bash
npm run seed -- --email you@gmail.com --confirm
npm run dev
```

**Check:**
- [ ] With seeded data, the weight chart shows the downward trend and a visible flat stretch in weeks 5–6
- [ ] The strength chart for Squat climbs, with the deload dip where the double miss happened
- [ ] A brand-new account (second Google login) sees friendly empty states instead of broken charts
- [ ] On the phone, the charts fit the screen width without sideways scrolling, and tooltips work on tap
- [ ] Lighthouse mobile run on the Vercel preview (Chrome DevTools → Lighthouse): Accessibility ≥ 90

---

### Phase 6: Gemini quick log
**Goal:** say one sentence, confirm, done.

**You do:** create a Gemini API key and add `GEMINI_API_KEY` to `.env.local` and to Vercel (server-only, no `NEXT_PUBLIC_` prefix).

**Build:**
- **Quick log box** on Today: a text field. The phone keyboard's dictation mic works everywhere, and there's an in-app mic button using the Web Speech API where the browser supports it
- `POST /api/quick-log` (signed-in users only, rate-limited per user):
  - Sends the sentence plus today's date and the user's exercise names to Gemini, with a **JSON response schema**
  - Gemini returns a draft: daily log fields and/or workout sets. **No calculated fields are accepted**
  - The response is validated with the same Zod schemas as the manual forms. Invalid or ambiguous parts come back flagged rather than guessed
- **Confirm card:** shows exactly what will be saved, in editable fields. Fields Gemini wasn't sure about are highlighted. **Save** goes through the normal server actions. **Cancel** discards the draft. Nothing is saved without a tap
- **"Explain this"** on the weekly review: the engine's outcome and numbers are sent to Gemini to be rephrased in plain words. It's told not to introduce new numbers, and the original engine message is always shown alongside
- Tests: Zod rejection of malformed or extra fields, and a mocked Gemini response going through the parse → confirm mapping

**Run:**
```bash
npm test
npm run dev
```

**Check:**
- [ ] *"Weighed 84.2 this morning, slept 7 hours, about 9k steps, diet mostly on, hunger 3"* → the confirm card shows all 5 fields correctly. Saving creates today's log
- [ ] *"Bench 3 sets of 5 at 62.5, last one RIR 1"* → three sets on the right exercise
- [ ] *"I had pizza"* → nothing useful to log. Clear message, nothing saved
- [ ] Cancelling a draft leaves the database unchanged
- [ ] In the browser DevTools Network tab, the Gemini key never appears in any response or JS bundle
- [ ] Dictating into the quick log box on the phone works end to end

---

## 4. Out of scope (for now)
Apple Health / Google Fit sync · food logging and macro tracking · workout program templates beyond "repeat last workout" · push notifications · offline mode · coach or social features · imperial units.

## 5. Decisions to confirm (defaults are already in the plan)
1. **RIR rule:** if all reps are hit but RIR is above 2 (too easy), the plan **holds the weight**, taking your wording literally. Many programs would add weight here instead. Hold, or progress?
2. **Safety thresholds:** loss > 1.0%/week → +150 kcal. Wellbeing "low" = average ≤ 2.0. Okay?
3. **Loss between 0.7% and 1.0%:** treated as on track (no change). Okay?
4. **Stall** = under 0.3% for **2 weeks in a row** (1 week is often just water). Okay?
5. **Ladder:** steps +2,000 → −150 kcal → steps +2,000 → −150 kcal → diet break. Okay, or a different ladder?
6. **Applying changes:** new targets from the weekly review are **applied automatically** and explained ("the app decides"), rather than waiting for you to accept them. Okay?
