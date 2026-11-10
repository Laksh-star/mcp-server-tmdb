# Changelog

## Unreleased

### Personal Availability Radar

- Add `check_watchlist_availability` to local/remote MCP and Radar inside My Watchlist.
- Compare caller-owned per-country baselines by provider ID, with subscription/rental/purchase distinctions and selected-service highlights.
- Keep failed or missing-country checks out of removal counts and retain the last successful baseline.
- Refresh the README with a custom banner, navigation/badges, workflow tables, and dated live screenshots. Move detailed commands to `docs/usage.md`.
- Mask the browser access-token input and align package license metadata with the repository's MIT license.

## Planning Lab — 2026-11-10

Source release: [planning-lab-2026-11-10](https://github.com/Laksh-star/mcp-server-tmdb/releases/tag/planning-lab-2026-11-10).

### Release Calendar in Planning Lab

- Browse upcoming and recent release windows with country/genre controls.
- See subscription, rental, and purchase availability separately.

### TV Binge Planner

- Add `build_tv_binge_plan` to local and remote MCP and a matching Planning Lab view.
- Find series within an estimated whole-series time budget and daily viewing pace.
- Support ended-only discovery, regional subscription requirements, genre/language filters, and watched-ID exclusions.
- Label missing-runtime assumptions and keep cancelled series distinct from ended ones.

### Saved Watchlists

- Save movies and TV in browser storage, mark watched, and record likes/dislikes.
- Back up and merge versioned JSON; preserve existing state after invalid imports or storage failures.
- Use saved movie preferences for taste recommendations and watched IDs for collection progress.
- Add caller-supplied `excludeMovieIds` to solo, party, and taste workflows; no personal state is stored by MCP.

### Verification

- Add offline coverage, a deterministic TMDB fixture, and HTTP/remote MCP checks.
