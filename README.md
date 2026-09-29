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
npm test
npm run build
npm run check
```

The Next.js application lives in `apps/web`, the scheduled worker foundation lives in `apps/collector`, shared runtime contracts live in `packages/shared`, store adapters live in `packages/collectors`, and the Drizzle schema and SQL migrations live in `packages/db`.

Copy `apps/web/.env.example` to `apps/web/.env.local` when Phase 0.2 connects Supabase. Never commit `.env.local`.

For database migrations, copy the root `.env.example` to `.env.local`, add `DIRECT_URL` or `DATABASE_URL`, then run:

```bash
npm run db:generate
npm run db:check
npm run db:migrate
npm run db:verify
```

Run the Apple adapter's small live contract check separately from deterministic CI:

```bash
npm run smoke:apple --workspace @analytic-dashboard/collectors
npm run smoke:google-play --workspace @analytic-dashboard/collectors
```

See `docs/MVP_IMPLEMENTATION_PLAN.md` for product scope and architecture.
