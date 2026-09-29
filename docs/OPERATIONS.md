# Operations

Commands for maintainers. They read configuration from the root `.env.local`; never commit it or
paste its values anywhere.

## Collection and classification

The scheduled GitHub Actions workflow (`.github/workflows/collect.yml`) runs these every six hours.
All of them are safe to rerun. `--dry-run` computes without writing to the database.

```bash
npm run discover --workspace @analytic-dashboard/collector -- --dry-run
npm run discover --workspace @analytic-dashboard/collector -- --source google_play --country us
npm run classify --workspace @analytic-dashboard/collector -- --dry-run
npm run classify-ai --workspace @analytic-dashboard/collector -- --dry-run --limit 16
```

`classify-ai` sends listing text to the AI provider and uses its quota, even in a dry run. Keep
manual runs small.

Opportunity research runs once a day from `.github/workflows/research.yml` (01:43 UTC). It reads
stored data only, and a rerun within the same UTC hour over unchanged data writes nothing.

```bash
npm run research --workspace @analytic-dashboard/collector -- --dry-run
npm run research --workspace @analytic-dashboard/collector -- --country id
```

## Database

```bash
npm run db:migrate
npm run db:verify
```

Migrations are additive SQL files in `packages/db/drizzle`. Integration tests need a separate,
disposable test database; never point them at production.

## Store smoke tests

Live requests to the stores, run manually and kept out of CI:

```bash
npm run smoke:apple --workspace @analytic-dashboard/collectors
npm run smoke:google-play --workspace @analytic-dashboard/collectors
```

## Before committing

```bash
npm run check
```
