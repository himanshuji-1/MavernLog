# MavernLog

Log your day. The app decides what's next. See [PLAN.md](PLAN.md) for the phased build plan.

## One-time setup (Phase 1)

### 1. Supabase (dev project)
1. Create a project at <https://supabase.com/dashboard>.
2. **Project Settings → API**: copy the Project URL and the `anon` key into `.env.local` (copy `.env.example` first).
3. Link and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```

### 2. Google sign-in
1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **OAuth consent screen** (External; add yourself and any testers as test users).
2. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
3. In Supabase: **Authentication → Providers → Google** → enable, paste the Client ID and Secret.
4. In Supabase: **Authentication → URL Configuration**
   - Site URL: your production URL (use `http://localhost:3000` until you have one)
   - Redirect URLs: `http://localhost:3000/**` and `https://*.vercel.app/**` (plus your production domain)

### 3. Vercel
1. Import this repo at <https://vercel.com/new>.
2. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Every branch push gets a preview URL. Use it for phone testing: Google sign-in won't redirect to a LAN IP.

## Gemini quick log (Phase 6)
1. Create a key at <https://aistudio.google.com/apikey>.
2. Put `GEMINI_API_KEY=...` in `.env.local`, and in Vercel (Project → Settings → Environment Variables). **Never** prefix it with `NEXT_PUBLIC_`.
3. `npx supabase db push` (adds the usage table used for rate limiting), then `npm run gemini:check` to test the key.

Without a key the app works as before: the quick-log box and "Explain this" buttons simply don't appear.

## Everyday commands

```bash
npm run dev         # http://localhost:3000
npm run lint
npm run typecheck
npm test
npx supabase db push
npm run gemini:check   # tests your Gemini key with two sample sentences
npm run seed -- --email you@gmail.com --confirm   # 8 weeks of fake data for ONE user (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)
```
