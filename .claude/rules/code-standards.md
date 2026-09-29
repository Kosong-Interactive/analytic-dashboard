# Code Standards

- Keep changes focused and readable.
- Avoid nested ternaries and clever compression.
- Add comments only when the reason or invariant is not evident from the code.
- Do not weaken types to make external data compile.
- Do not log secrets, authorization headers, full review bodies, or raw AI prompts containing sensitive data.
- Do not catch errors only to discard them; record actionable context while returning safe messages to clients.
- Use bounded retry with jitter only for transient failures.
- Keep tests deterministic; live store checks belong in a separate smoke workflow.

## Required tests by area

- Collectors: fixture parsing, normalization, missing fields, throttling/retry decisions, and idempotency.
- Database: migrations from empty state, constraints, repository behavior, and representative analytical queries.
- Analytics: known input/output fixtures, missing observations, cohort boundaries, and score-version behavior.
- Classifier: taxonomy validation, cache/input hash, malformed provider output, and manual-override precedence.
- Web: critical rendering states and filter/query parsing; use browser tests for important user flows when available.

## Avoid

- Network calls directly from presentation components.
- Long work inside Route Handlers.
- Scraper types leaking into shared domain APIs.
- Unversioned scoring or taxonomy changes.
- Storing every unchanged snapshot.
- Adding infrastructure for hypothetical scale.
