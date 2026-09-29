---
name: commit
description: Prepare and create a focused conventional Git commit in analytic-dashboard when the user explicitly asks to commit changes.
---

# Commit

Use the format `<type>: <short lowercase description>` with an appropriate type such as `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, or `style`.

Before committing:

1. Inspect status and the relevant diff.
2. Separate unrelated user changes.
3. Run checks proportional to the staged change.
4. Stage explicit files rather than the entire repository.
5. Inspect the staged diff.
6. Confirm no environment file, key, password, connection string, raw sensitive payload, or generated artifact is included.

Create one logical commit. Do not add AI authorship or co-author trailers. After committing, verify status and report the commit hash plus checks run. Do not push unless the user also requested it.
