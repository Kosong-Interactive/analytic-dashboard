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
- Secret key only if a trusted server operation truly requires bypassing Row Level Security.
- Database password if the chosen connection string embeds it.

Server-only values must never use a `NEXT_PUBLIC_` prefix.

## Suggested environment variable categories

Final variable names should be added to `.env.example` during scaffolding. Expected categories are:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
DATABASE_URL
DIRECT_URL                         # optional migration connection
SUPABASE_SECRET_KEY                # only if actually required
```

For a new project, use Supabase's current `sb_publishable_...` and `sb_secret_...` key types. Do not start a new integration with the legacy JWT-based `anon` or `service_role` keys.

## Where to get each value

1. Open the Supabase Dashboard and select the project.
2. Click **Connect** at the top of the project page.
3. Copy **Project URL** to `NEXT_PUBLIC_SUPABASE_URL`.
4. Copy **Publishable key** to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. In the same **Connect** dialog, open the database connection section:
   - use the transaction pooler for short-lived serverless application connections;
   - use direct connection for migrations when the machine supports IPv6;
   - otherwise use the session pooler for migrations or other IPv4-only environments.
6. Replace `[YOUR-PASSWORD]` locally with the database password. Percent-encode reserved characters in the password.
7. Put the application connection in `DATABASE_URL` and, when a separate migration connection is needed, put it in `DIRECT_URL`.
8. Leave `SUPABASE_SECRET_KEY` empty initially. If a later server-only job requires elevated API access, create/copy a secret key from **Settings > API Keys** and store it only in server-side secret storage.

The publishable key is intentionally safe to ship to a browser only when Row Level Security and grants are configured correctly. A secret key bypasses RLS and must never use a `NEXT_PUBLIC_` prefix.

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

## Running the Phase 0.2 migration

1. At the repository root, copy `.env.example` to `.env.local`.
2. In the Supabase project, click **Connect** and copy a database connection URI.
3. Replace the password placeholder locally. Do not paste the completed URI into chat.
4. Set `DATABASE_URL` to the transaction-pooler URI for future serverless queries.
5. Set `DIRECT_URL` to a direct URI when IPv6 is available, or a session-pooler URI when it is not. If only one connection is available, leave `DIRECT_URL` empty and migrations will use `DATABASE_URL`.
6. Generate and verify the checked-in SQL migration:

   ```bash
   npm run db:generate
   npm run db:check
   ```

7. Apply pending migrations:

   ```bash
   npm run db:migrate
   npm run db:verify
   ```

8. In **Table Editor**, verify the nine initial tables exist: `apps`, `store_apps`, `app_snapshots`, `chart_entries`, `reviews`, `taxonomy_labels`, `app_labels`, `collector_runs`, and `jobs`.
9. Verify Row Level Security is enabled for all nine tables. The initial migration intentionally creates no public policies; browser clients must not have direct access to internal collector data.

The checked-in migration can be generated and validated without a live database. Applying it to Supabase requires `DIRECT_URL` or `DATABASE_URL`; the public project URL and publishable key cannot run database migrations.
