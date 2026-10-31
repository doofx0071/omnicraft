# Supabase Auth setup

This frontend-only React/Vite TypeScript project uses Supabase Auth for identity and sends each
signed-in user's JWT through the Supabase Data API. The `notes` table is protected by row-level
security (RLS). No API server, local application database, service-role key, or account-linking
layer is generated.

## Configure a Supabase project

1. Create a Supabase project manually in the Supabase dashboard.
2. In **Project Settings → API**, copy the project URL and the **publishable** key into the
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` entries in `.env`.
3. In **Authentication → URL Configuration**, add `http://localhost:5173` as the local site URL.
   Configure your real deployment origin and redirect URLs separately before production use.
4. In **Authentication → Providers → Email**, choose the email confirmation behavior required by
   your project. Local Supabase development disables confirmations by default; hosted projects may
   require them.

The generated values are placeholders. A publishable key is intended for browser use and is safe
only with appropriate RLS policies and grants. Never put a Supabase secret key, legacy service-role
key, database password, or JWT signing secret in a `VITE_` variable or browser bundle. The generated
client does not need a privileged key.

## Run locally

Install Node.js and Docker, then run:

```bash
npm install
npm run supabase:start
npm run supabase:reset
npm run dev
```

The local Supabase stack reads `supabase/config.toml` and applies
`supabase/migrations/20261101000000_create_private_notes.sql`. The migration explicitly grants only
`SELECT`, `INSERT`, `UPDATE`, and `DELETE` to `authenticated`, revokes table access from `anon` and
`PUBLIC`, enables RLS, and checks `auth.uid()` for every operation. New public tables require
explicit Data API grants.

Use the local publishable key printed by the Supabase CLI only in your local `.env`; do not commit
that file or paste local keys into issues, logs, or screenshots. Stop local services with
`npx --yes supabase@2.122.0 stop --no-backup`.

## Authentication and data behavior

- Create an account or sign in with email/password.
- The Supabase client restores its browser session from local storage.
- Note requests go directly to the Data API with the signed-in user's JWT; RLS restricts reads,
  inserts, updates, and deletes to that user.
- Sign out uses the local session scope and clears this browser's session.

`supabase.auth.getSession()` is used only in the browser to restore local UI state. Do not use its
result as server-side token verification. This project has no server-side auth boundary.
