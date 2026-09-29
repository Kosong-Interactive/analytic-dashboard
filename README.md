# Analytic Dashboard

Mobile-game market intelligence dashboard for tracking new releases, momentum, genre and mechanic trends, and historical store observations.

## Requirements

- Node.js 20.9 or newer (`.nvmrc` currently selects 20.20.2)
- npm 10 or newer

## Workspace commands

```bash
nvm use
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
```

The Next.js application lives in `apps/web`. The Drizzle schema and SQL migrations live in `packages/db`.

Copy `apps/web/.env.example` to `apps/web/.env.local` when Phase 0.2 connects Supabase. Never commit `.env.local`.

For database migrations, copy the root `.env.example` to `.env.local`, add `DIRECT_URL` or `DATABASE_URL`, then run:

```bash
npm run db:generate
npm run db:check
npm run db:migrate
npm run db:verify
```

See `docs/MVP_IMPLEMENTATION_PLAN.md` for product scope and architecture.
