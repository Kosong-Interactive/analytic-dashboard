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

The Next.js application lives in `apps/web`. Database and collector work will be added in subsequent Phase 0 steps.

Copy `apps/web/.env.example` to `apps/web/.env.local` when Phase 0.2 connects Supabase. Never commit `.env.local`.

See `docs/MVP_IMPLEMENTATION_PLAN.md` for product scope and architecture.
