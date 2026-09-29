---
name: "source-command-new-collector"
description: "Migrated source command `new-collector`"
---

# source-command-new-collector

Use this skill when the user asks to run the migrated source command `new-collector`.

## Command Template

# New Store Collector

Create or extend a store collector for the supplied source operation.

Usage: `/project:new-collector <source> <operation>`

- Start from the shared collector contract.
- Keep source response types private to the adapter.
- Parse with Zod and map to normalized domain types.
- Add cache policy, source budget, bounded concurrency, retry classification, jitter, and circuit-breaker behavior.
- Make persistence and jobs idempotent.
- Record collector-run counts and errors without secrets.
- Add fixtures for success, missing fields, malformed response, rate limiting, and empty results.
- Add a small live smoke test only to the separate scheduled workflow.
