# Study Planner (درس‌یار)

A Persian study planner built with React, TypeScript, Vite, and a local Node API on PostgreSQL.

## Docs

- [docs/README.md](docs/README.md) — فهرست مستندات
- [docs/PROMPTS.md](docs/PROMPTS.md) — پرامپت موج‌ها (بعدی: موج B)
- [PRODUCT.md](PRODUCT.md) · [FEATURES.md](FEATURES.md) · [STATUS.md](STATUS.md) · [ROADMAP.md](ROADMAP.md)
- [FRONTEND.md](FRONTEND.md) · [BACKEND.md](BACKEND.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

Layout: `apps/web` (Vite/React) + `apps/api` (HTTP API). Do not split into two GitHub repos yet — see ARCHITECTURE.md.

## Run locally

```sh
npm install
npm run dev:app
```

This starts the API on `http://127.0.0.1:8788` and the web app on port `5174`. Database settings live in `.env.local` (git-ignored). Do not commit or paste passwords.

Health check: `http://127.0.0.1:8788/health`

Guest mode still exists until wave B. Student signup/login goes to the local API.

```sh
npm run migrate   # apply SQL in apps/api/sql
npm test          # API unit + health smoke
npm run build
npm run lint
```

## Optional demo API (legacy role seeds)

```sh
npm run dev:demo
```

Seeded accounts (demo only):

- Advisor: `advisor@demo.test` / `advisor123`
- Linked student: `student@demo.test` / `student123`
- Independent student: `solo@demo.test` / `student123`

The demo API is `127.0.0.1:8787`. Data stays under `.data/` (git-ignored).
