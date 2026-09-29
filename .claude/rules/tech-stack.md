# Tech Stack

## Target stack

- Next.js App Router with strict TypeScript
- React Server Components by default
- Tailwind CSS and shadcn/ui
- TanStack Query/Table for client-side server state and data grids
- Apache ECharts for analytical visualization
- Zod for runtime contracts
- Supabase PostgreSQL
- Drizzle ORM and SQL migrations
- Node.js/TypeScript collector runtime
- pnpm workspaces and Turborepo

## Dependency rules

- Check existing workspace packages before adding a dependency.
- Do not add a second library for an existing responsibility without justification.
- Scraper packages are collector-only dependencies.
- Database drivers and service-role credentials are server-only.
- AI SDK usage is isolated behind a provider interface in `packages/classifier`.
- Avoid Redis or an external queue until PostgreSQL job processing is demonstrably insufficient.

## Environment

Never commit real values. Expected categories include:

- public Supabase URL and publishable key for permitted browser use;
- server-only database/service credentials;
- AI provider credentials;
- collector concurrency, cache TTL, and request-budget settings;
- optional error-tracking configuration.

Create or update `.env.example` whenever application code introduces a required environment variable.
