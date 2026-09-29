# Folder Structure

```text
apps/
  web/
    app/                         App Router routes, layouts, loading/error boundaries
    components/                  web-only composed components
    lib/                         web-only adapters and query composition
  collector/
    src/commands/                CLI/scheduled entry points
    src/jobs/                    job handlers
    src/runtime/                 leasing, retry, throttling, logging
packages/
  db/src/                        schema, migrations, repositories, queries
  collectors/src/apple/          Apple adapter
  collectors/src/google-play/    Google Play adapter
  collectors/src/contracts/      shared collector contracts
  analytics/src/                 pure analytical functions
  classifier/src/                taxonomy, rules, providers, validation
  shared/src/                    cross-workspace types/schemas/utilities
  ui/src/                        reusable UI primitives
config/
  countries/                     enabled storefront configuration
  discovery-seeds/               versioned search/category seeds
  taxonomy/                      controlled classification vocabulary
docs/                             architecture and operating documentation
```

## Placement rules

- Keep route-local components close to their route when they are not reused.
- Promote UI to `packages/ui` only after it is genuinely shared.
- Keep server-only modules clearly separated and guarded from client imports.
- Put store-specific translation inside its adapter, not in shared analytics.
- Put domain queries in `packages/db`, not React components.
- Co-locate unit tests with the module or follow the workspace test convention once established; do not mix conventions within one package.
- Use barrel exports sparingly; do not create cycles or hide server/client boundaries.
