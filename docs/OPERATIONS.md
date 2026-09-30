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

AI research briefs are generated only for scored opportunities. `--plan` is read-only and does not
call Gemini or print evidence. `--dry-run` does call Gemini and sends the bounded evidence registry,
but writes no rows. A normal run stores the validated brief and exact evidence snapshot.

```bash
npm run research-brief --workspace @analytic-dashboard/collector -- --plan
npm run research-brief --workspace @analytic-dashboard/collector -- --dry-run --limit 1
npm run research-brief --workspace @analytic-dashboard/collector -- --limit 10
```

The scheduled brief step is disabled by default. After explicit approval to send opportunity
evidence to Gemini, add the GitHub Actions repository variable `ENABLE_RESEARCH_BRIEFS=true`.
The existing `GEMINI_API_KEY` secret is reused.

Opportunity durability, acceleration, timeline, and material-change alerts are derived on read from
the append-only daily research results. They do not have a separate command or table. A 30/90-day
window stays visibly in `collecting` state until enough real history exists; do not backfill it with
fabricated scores.

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

The Steam check needs `STEAM_WEB_API_KEY` in the environment (about 9 requests; it prints counts
and sample values, never the key):

```bash
(set -a; . ./.env.local; set +a; npm run smoke:steam --workspace @analytic-dashboard/collectors)
```

Steam Global collection (both charts, listings, `us`/`id` prices, review totals, players). About
410 requests and 7 minutes for 200 games; `--dry-run` calls Steam but writes nothing:

```bash
npm run discover-steam --workspace @analytic-dashboard/collector -- --dry-run --max-games 5
```

## Before committing

```bash
npm run check
```
