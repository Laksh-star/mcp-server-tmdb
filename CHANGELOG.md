# Changelog

## Unreleased

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
