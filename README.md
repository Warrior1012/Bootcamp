# JSS Placement Intelligence Hub

React + Vite + TypeScript UI for the Bootcamp Supabase project.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Use only the Supabase publishable/anon key in frontend code; never use a service-role key.

The app reads companies, company profiles, skill requirements, skill topics, and proficiency levels from Supabase. Read-only RLS policies are required for the corresponding tables.
