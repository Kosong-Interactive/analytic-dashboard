# Deploying the dashboard to Vercel

Only `apps/web` runs on Vercel. The collector does **not**: it runs from GitHub Actions
(`.github/workflows/collect.yml`) and writes to the same Supabase database the dashboard reads.

> Status: these steps follow the repository layout and Vercel's monorepo model. They have not
> been run against a real Vercel project yet. Vercel setting labels change over time, so treat
> the names below as a checklist and confirm them in the project settings.

## Why the settings differ from a single-app repository

- The web app imports workspace packages. `@analytic-dashboard/analytics` and
  `@analytic-dashboard/shared` are consumed from their compiled `dist/`, so they must be built
  **before** `next build`. Turborepo does that through `dependsOn: ["^build"]`.
- `@analytic-dashboard/db` exports TypeScript source; `next.config.ts` lists it in
  `transpilePackages`, so it needs no build step.
- There is one lockfile at the repository root, so install must run against the whole workspace.

## 1. Create the project

1. In Vercel, **Add New → Project** and import `Kosong-Interactive/analytic-dashboard`.
2. Set **Framework Preset** to Next.js.
3. Set **Root Directory** to `apps/web`.
4. Keep **Include source files outside of the Root Directory in the Build Step** enabled
   (it is required so the build can see `packages/*` and the root lockfile).
5. Set **Node.js Version** to `22.x` (the repository requires `>=22.12.0`; Vercel does not read `.nvmrc`).

## 2. Build settings

Override the defaults so packages build first and only the web app's dependency graph is built:

| Setting | Value |
|---|---|
| Install Command | `cd ../.. && npm ci` |
| Build Command | `cd ../.. && npx turbo run build --filter=@analytic-dashboard/web` |
| Output Directory | *(leave default, `.next`)* |

`turbo.json` declares `dependsOn: ["^build"]`, so the workspace packages the web app imports
(`analytics`, `shared`, `db`) are built first. Writing the filter as `@analytic-dashboard/web...`
is equivalent.

**Ignored Build Step** (optional, avoids deploys for collector-only or docs-only commits):

```bash
git diff --quiet HEAD^ HEAD -- apps/web packages package.json package-lock.json turbo.json
```

Exit code `0` skips the build, `1` builds.

## 3. Environment variables

Set these in **Settings → Environment Variables**. Never commit real values.

| Variable | Scope | Notes |
|---|---|---|
| `DATABASE_URL` | Production, Preview | Use the Supabase **transaction pooler** URL (port `6543`). Serverless functions open many short connections and a direct connection will exhaust the limit. |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | **Required**: the dashboard login uses Supabase Auth. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview | **Required**. Publishable key only, never the secret/service-role key. |

`NEXT_PUBLIC_*` values are inlined into the browser bundle at **build** time. After adding or
changing them, trigger a new deployment (Deployments → Redeploy); saving the variable alone does
not update a running deployment.

Locally all of these live in the repository root `.env.local`; the web app loads it on demand.
On Vercel that file does not exist, so every variable above must be set in the project settings.

`DIRECT_URL`, `TEST_DATABASE_URL`, and all collector settings are **not** needed on Vercel.
The dashboard only reads: it never starts collection, so the database role can be read-only
if you prefer to create one.

Preview deployments would read the same database as production. That is safe for a read-only
dashboard, but use a separate `DATABASE_URL` for Preview if you ever add write paths.

## 4. Protect the deployment

The dashboard has its own email + password login (Supabase Auth); every page redirects to
`/login` when signed out. Before sharing the URL:

1. In Supabase, **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up",
   then create each teammate under **Authentication → Users → Add user**.
2. **Authentication → URL Configuration**: set **Site URL** to the production URL
   (for example `https://<project>.vercel.app`). Password sign-in works without it, but Supabase
   uses it for links in auth emails such as password resets; the default points at `localhost`.
3. Optionally also enable Vercel *Deployment Protection* for Preview deployments.

## 5. Region

Set the Function Region (**Settings → Functions**) to the region closest to the Supabase
project, to keep query latency low. Record the chosen region in private deployment notes.

## 6. Verify after the first deploy

- Open the Production URL and confirm the Overview renders freshness and the *Data coverage* panel.
- Check the *Last Collected* card: if it says "never" or the sources are *Stale*, the collector
  workflow is not running (see the `DATABASE_URL` repository secret in GitHub) rather than the
  dashboard being broken.
- Signing in should land on the Overview and show your email in the top bar. If `/login` loops or
  shows an error, check the two `NEXT_PUBLIC_SUPABASE_*` variables and redeploy.
- A page showing "The overview could not be loaded" usually means `DATABASE_URL` is missing or
  points at the wrong pooler. Check the function logs; error text is intentionally not shown in the UI.

## Local parity

Next.js reads `.env.local` from `apps/web`, not from the repository root. To run the dashboard
locally either copy `DATABASE_URL` into `apps/web/.env.local` or export it in the shell first:

```bash
nvm use
npm run dev:web
```
