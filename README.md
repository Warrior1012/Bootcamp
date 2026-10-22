# JSSU Placement Intelligence Hub

A React, Vite, and TypeScript interface for browsing company profiles, skill requirements, and skill topics.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Frontend code should use only the Supabase publishable or anon key. Never use a service-role key in browser code.

The app reads company information, company profiles, skill requirements, skill topics, and proficiency levels from its configured Supabase source. The corresponding tables need appropriate read access policies.

## Build

```bash
npm run build
```

## URL views

The app uses hash-based navigation and does not require server rewrite rules:

- `#company=12&tab=companies` opens a company profile in the directory.
- `#company=12&tab=skills` opens skill intelligence for a company.
- `#privacy` opens the privacy information.
- `#terms` opens the terms information.

Replace `12` with a company ID present in the configured dataset.
