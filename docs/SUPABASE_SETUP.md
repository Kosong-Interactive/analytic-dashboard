# Supabase Setup Inputs

The user already has a Supabase account. Do not request or paste secrets into chat, documentation, commits, screenshots, or issue trackers.

## Information the user will choose or confirm

- Supabase project name, suggested: `analytic-dashboard`.
- Organization in which the project should be created.
- Region closest to the main collector/database workload.
- Database password, entered directly in Supabase and stored in the user's password manager.
- Whether the initial dashboard is private and requires authentication.
- Allowed production and local callback/site URLs if authentication is enabled.

## Values copied into local or deployment environment

### Safe/public application configuration

- Project URL.
- Publishable/anon key, only for browser operations permitted by Row Level Security.

### Server-only secrets

- Direct or pooled database connection string used by migrations/server code.
- Service-role key only if a server-side operation truly requires it.
- Database password if the chosen connection string embeds it.

Server-only values must never use a `NEXT_PUBLIC_` prefix.

## Suggested environment variable categories

Final variable names should be added to `.env.example` during scaffolding. Expected categories are:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
DATABASE_URL
SUPABASE_SERVICE_ROLE_KEY          # only if actually required
```

## Setup sequence for Phase 0

1. User creates/selects the project and chooses its region.
2. User stores the database password privately.
3. Developer copies public values into local/deployment environment settings.
4. Developer stores server-only secrets in local and hosting secret managers.
5. Add `.env.example` with names but no values.
6. Run migrations from an empty database.
7. Enable required PostgreSQL extensions only when migrations need them.
8. Apply Row Level Security before exposing any browser-accessible table or function.
9. Verify browser clients cannot access collector jobs, raw payloads, secrets, or internal operational tables.
10. Record the chosen project reference and region in private deployment configuration, not in public docs if the team treats them as sensitive.

## Not needed yet

No Supabase input is required while the repository contains only planning and agent configuration. Ask for the values only when Phase 0 scaffolding is ready to connect and migrate the database.
