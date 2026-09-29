# Known Limitations and Risks

- Apple Search API discovery is seed/query based and not a complete release feed.
- Google Play collection depends on unofficial scraping and can break when markup or access behavior changes.
- The selected Google Play library must remain behind an adapter and have fixture plus live contract checks.
- Supabase free-tier storage requires change-only snapshots, review sampling, retention, and roll-ups.
- GitHub scheduled workflows can be delayed and should not be treated as precise real-time scheduling.
- Trend quality cannot be judged until enough historical snapshots exist.
- AI labels remain inferred data and require provenance and manual override support.

Only add verified, project-specific limitations. Remove entries when the underlying limitation is resolved.
