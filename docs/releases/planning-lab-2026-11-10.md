## Plan your next watch, then keep the list

This source release adds three workflows from [PR #34](https://github.com/Laksh-star/mcp-server-tmdb/pull/34):

- **Release Calendar in Planning Lab** — browse upcoming and recent movies by country, genre, and release window; see subscription, rental, and purchase listings separately.
- **TV Binge Planner** — find series within an estimated whole-series time budget, with daily viewing pace, Ended-only filtering, and regional subscription matches. Available in the browser and as `build_tv_binge_plan` in local/remote MCP.
- **Saved Watchlists** — save movies and TV in browser storage, track watched and liked/disliked entries, import/export JSON, and exclude watched titles from recommendations.

Try asking: “Find ended mystery series I can finish in 12 hours on Netflix in India, at 120 minutes per day.”

### Updating

Pull the source, install dependencies, build, and restart your MCP client. For Cloudflare-hosted installations, deploy the Worker separately; a GitHub merge does not update the hosted app.

### Validation

Build, offline workflow tests, plugin discovery, authenticated HTTP/remote MCP fixture checks, and Worker bundle checks passed. The merged Worker was deployed on 10 November 2026. Its live 25-tool contract and workflow calls passed, and browser checks verified calendar/TV results and saved state after reload.

Screenshots attached to this release were captured from that deployed app on 10 November 2026. Availability varies by country and date. TV runtimes are labelled estimates; missing runtimes assume 45 minutes per episode. Watchlists are local to the browser/site origin and should be exported before clearing site data.

Metadata: TMDB. Provider availability: TMDB / JustWatch.
