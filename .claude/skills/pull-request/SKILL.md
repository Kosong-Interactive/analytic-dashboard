---
name: pull-request
description: Prepare or create a GitHub pull request for analytic-dashboard when the user explicitly requests a PR, including validation and a concise evidence-based description.
---

# Pull Request

Determine the remote default branch from Git; do not assume `main` or `master`.

## Before creating

1. Check branch, status, remote, commits, and diff against the default branch.
2. Stop if intended changes are uncommitted or unrelated changes contaminate the PR.
3. Run relevant typecheck, lint, tests, build, migration, and live smoke checks as applicable.
4. Push the branch only when authorized by the user's request.

## Description

```markdown
## Summary
- What changed and why

## Data and architecture impact
- Schema, collection, scoring, classification, API, or UI implications

## Verification
- Commands and observable checks completed

## Limitations
- Unverified live sources, coverage constraints, migration notes, or follow-ups
```

Use GitHub, not GitLab. Do not claim checks passed unless they ran successfully. After creation, attach or report the PR URL.
