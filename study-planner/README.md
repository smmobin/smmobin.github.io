# Study Planner

A Persian study planner built with React, TypeScript, Vite, and Capacitor.

## Run locally

```sh
npm install
npm run dev
```

Without Supabase configuration, choose **مهمان محلی**. Guest data stays in the browser's local storage and is not sent to a server.

## Test student and advisor modes

Start both the Vite app and a local role-aware demo API:

```sh
npm run dev:demo
```

Open the Vite URL printed in the terminal. Seeded accounts:

- Advisor: `advisor@demo.test` / `advisor123`
- Student linked to the advisor: `student@demo.test` / `student123`
- Independent student: `solo@demo.test` / `student123`

The demo API is bound to `127.0.0.1:8787`. Workspace and invitation data persist under `.data/`, which is git-ignored. This test server uses fixed demo credentials and is not for production or network exposure.

## Test the student/advisor flows

Run the frontend and a local, loopback-only demo API together:

```sh
npm run dev:demo
```

Open the Vite URL printed in the terminal. Demo accounts:

- Advisor: `advisor@demo.test` / `advisor123`
- Student linked to the advisor: `student@demo.test` / `student123`
- Independent student: `solo@demo.test` / `student123`

The demo API listens only on `127.0.0.1:8787`; sample data is stored under ignored `.data/` and survives server restarts. These fixed credentials and this local API are for testing only, never production.

## Cloud accounts

The app supports student accounts and advisor accounts. Student accounts can be independent or linked to one advisor. An advisor can publish plan blocks for linked students; linked students can view their plan and record study sessions but cannot edit the assigned plan.

Set up Supabase and its row-level security migration using [supabase/README.md](supabase/README.md). Copy `.env.example` to `.env.local`, add the Supabase project URL and publishable/anon key, then restart Vite. Do not put a service-role key in frontend environment variables.

Cloud authentication and storage are disabled until those project-specific values are configured. Database changes are in [supabase/migrations/20261004000100_roles_workspaces.sql](supabase/migrations/20261004000100_roles_workspaces.sql).

## Checks

```sh
npm run build
npm run lint
```
