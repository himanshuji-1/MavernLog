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

## Everyday commands

```bash
npm run dev         # http://localhost:3000
npm run lint
npm run typecheck
npm test
npx supabase db push
```
