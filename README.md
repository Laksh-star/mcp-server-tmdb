# TMDB MCP Server

An MCP server for The Movie Database (TMDB) API. It provides movie and TV search, streaming availability, cast and crew details, and recommendations for assistants such as Codex and Claude Desktop.

## Tools

### Movie Discovery
- **get_weekend_watchlist** — Ranked weekend shortlist by mood, country, language, runtime, rating, and services
- **search_movies** — Search by title/keywords → titles, IDs, ratings, overviews
- **get_trending** — Top 10 trending movies (`timeWindow`: "day" | "week")
- **get_weekly_trending_by_language** — Weekly trending movies grouped by original language into English, Hindi, and Telugu
- **search_by_genre** — Movies by genre name, optional year filter
- **advanced_search** — Filter by genre, year, min rating, sort, language
- **search_by_keyword** — Find movies by theme/keyword (e.g. "zombie", "heist")

### Movie Details
- **get_movie_details** — Full details: cast, crew, runtime, genres, reviews (by `movieId`)
- **get_recommendations** — Top 5 recommendations based on a movie ID
- **get_similar_movies** — Similar movies via TMDB's similarity algorithm
- **get_watch_providers** — Streaming/rental/purchase availability by country (default: IN)

### TV Shows
- **search_tv_shows** — Search TV series by title
- **get_trending_tv** — Top 10 trending TV shows (`timeWindow`: "day" | "week")

### People
- **search_person** — Find actors, directors, crew by name → ID + known works
- **get_person_details** — Full bio + filmography (movies + TV) by `personId`

### Resources
- `tmdb:///movie/<id>` — Full movie details in JSON (title, cast, director, reviews, poster URL)

## Quick Start

1. Get a TMDB API key at [themoviedb.org](https://www.themoviedb.org/) → Account Settings → API

2. Clone, install, and build:
   ```bash
   git clone https://github.com/Laksh-star/mcp-server-tmdb.git
   cd mcp-server-tmdb
   npm install
   ```

3. Create a local env file and add your TMDB key:
   ```bash
   cp .env.example .env
   ```

4. Install the local Codex and Claude Desktop integration:
   ```bash
   npm run install:local
   ```

5. Restart Codex or Claude Desktop if already open.

6. Verify with a prompt like:
   ```text
   What movies are trending this week?
   ```

In Codex, a fresh session should show `TMDB` in the plugin list and expose the `mcp__tmdb__` namespace.

## Weekly Trending Language Demo

This repo includes a small shareable demo that calls the MCP tool `get_weekly_trending_by_language`, which fetches live TMDB weekly trending movies and groups the current first page by TMDB `original_language`.

Run it against the local stdio MCP server:

```bash
npm run build
set -a && source ./.env && set +a && npm run demo:weekly-trending
```

After deploying this version of the Worker, run the same demo against a remote MCP endpoint:

```bash
TMDB_MCP_ACCESS_TOKEN=<your-access-token> node scripts/weekly-trending-languages.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp
```

If the deployment is intentionally authless for personal testing, omit `TMDB_MCP_ACCESS_TOKEN`.

## Remote MCP on Cloudflare Workers

This repo can also run as a remote MCP server on Cloudflare Workers. The remote server exposes the same TMDB tools at `/mcp` over Streamable HTTP, so Claude, Cowork, Claude Desktop connectors, and other remote-MCP clients can connect to a public URL.

The existing local stdio server remains unchanged for Codex and local Claude Desktop use. The Cloudflare entrypoint is `src/worker.ts`.

The Worker also serves a browser demo at `/`: **Weekend Watch Concierge**. It asks for mood, country, language, runtime, rating, and streaming services, then builds a ranked movie shortlist using TMDB discovery, trending, now-playing, credits, posters, and watch-provider data.

![Weekend Watch Concierge weekly trend scan](docs/assets/weekend-watch-concierge-weekly-trends.png)

For the complete browser app, deployed Worker, access-token, and MCP handoff, see `docs/weekend-watch-concierge.md`.

### Deploy

1. Log in to Cloudflare:
   ```bash
   npx wrangler login
   ```

2. Store your TMDB key as a Worker secret:
   ```bash
   npx wrangler secret put TMDB_API_KEY
   ```

3. Store an access token as a Worker secret before sharing the deployment:
   ```bash
   npx wrangler secret put ACCESS_TOKEN
   ```

   When `ACCESS_TOKEN` is set, `POST /api/concierge` and `POST /mcp` require:
   ```text
   Authorization: Bearer <your-access-token>
   ```

4. Check the Worker bundle:
   ```bash
   npm run worker:dry-run
   ```

5. Deploy:
   ```bash
   npm run worker:deploy
   ```

Cloudflare will print a URL like:

```text
https://tmdb-mcp.<your-workers-subdomain>.workers.dev
```

Use this MCP endpoint in remote clients:

```text
https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp
```

Use this browser demo URL:

```text
https://tmdb-mcp.<your-workers-subdomain>.workers.dev/
```

### Connect from Claude / Cowork

For Claude custom connectors:

1. Open Claude settings: `Customize` -> `Connectors`.
2. Click `+` -> `Add custom connector`.
3. Use the deployed Worker MCP URL:
   ```text
   https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp
   ```
4. Enable the connector in a conversation and ask a TMDB question, such as:
   ```text
   What movies are trending this week?
   ```

For Claude Desktop versions or MCP clients that still require a local command, use the `mcp-remote` proxy:

```json
{
  "mcpServers": {
    "tmdb-remote": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp"
      ]
    }
  }
}
```

### Security note

If `ACCESS_TOKEN` is not configured, the Worker is authless for easy personal testing. Anyone who has the Worker URL can call the read-only TMDB tools and consume your TMDB API quota. Keep `ACCESS_TOKEN` configured or use Cloudflare Access before sharing this beyond your own accounts.

## Weekend Watch Concierge

Run the Worker locally:

```bash
npm run worker:dev
```

This syncs local values from `.env` into an untracked `.dev.vars` file so Wrangler can expose `TMDB_API_KEY` to the Worker during local development.

For protected local testing, add `ACCESS_TOKEN` to `.env`. The browser app has an access-token field and the smoke scripts can read `ACCESS_TOKEN` or `TMDB_MCP_ACCESS_TOKEN` from the shell environment.

Open:

```text
http://127.0.0.1:8787/
```

Smoke test the concierge API after the local Worker is running:

```bash
npm run smoke:concierge
```

Smoke test the remote MCP endpoint and call the agent-facing concierge tool:

```bash
node scripts/remote-mcp-smoke.mjs http://127.0.0.1:8787/mcp --call-concierge
```

For a protected deployment:

```bash
TMDB_MCP_ACCESS_TOKEN=<your-access-token> node scripts/remote-mcp-smoke.mjs https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --call-concierge
```

Or test a deployed Worker:

```bash
node scripts/concierge-smoke.mjs https://tmdb-mcp.<your-workers-subdomain>.workers.dev
```

The app uses:

- `POST /api/concierge` for ranked movie picks
- `GET /health` for deployment health
- `POST /mcp` for remote MCP clients

Agents can call `get_weekend_watchlist` with:

- `mood`: `crowd`, `thriller`, `thoughtful`, `funny`, `family`, or `mindbend`
- `country`: watch-provider region, for example `IN` or `US`
- `language`: original language code, for example `en`, `hi`, `ta`, `te`, or `any`
- `runtime`: maximum minutes, for example `120`, `150`, or `any`
- `minRating`: minimum TMDB rating
- `services`: preferred streaming services

## What `npm run install:local` does

The installer uses the repo-owned launcher at `plugins/tmdb/scripts/run-server.sh`.

For Codex it:

- Registers the launcher as an MCP server
- Installs a local `TMDB` plugin payload so it appears in the plugin UI

For Claude Desktop it:

- Registers the same launcher as a local MCP server

It updates:

- `~/.codex/config.toml`
- `~/.codex/.tmp/plugins/.agents/plugins/marketplace.json`
- `~/.codex/plugins/cache/openai-curated/tmdb/...`
- `~/Library/Application Support/Claude/claude_desktop_config.json`

The launcher reads `TMDB_API_KEY` from your shell environment or from the repo `.env` file.

## Usage with Claude Desktop

If you prefer manual setup, add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tmdb-local": {
      "command": "/full/path/to/mcp-server-tmdb/plugins/tmdb/scripts/run-server.sh",
      "args": []
    }
  }
}
```

Restart Claude Desktop after editing the config.

## Usage with Codex

The installer adds these blocks to `~/.codex/config.toml`:

```toml
[mcp_servers.tmdb_local]
command = "/full/path/to/mcp-server-tmdb/plugins/tmdb/scripts/run-server.sh"

[plugins."tmdb@openai-curated"]
enabled = true
```

Restart Codex after editing the config. In a fresh Codex session, `TMDB` should appear in the plugin list and contribute the `mcp__tmdb__` namespace.

## Validation

Offline smoke test:

```bash
TMDB_API_KEY=dummy node plugins/tmdb/scripts/smoke-test.mjs
```

Online smoke test:

```bash
set -a && source ./.env && set +a && node plugins/tmdb/scripts/smoke-test.mjs --online
```

## Plugin Docs

For plugin packaging, local install behavior, and Codex-specific notes, see `plugins/tmdb/README.md`.

## Usage with BizClaw / NanoClaw

Built into the agent container. Just set `TMDB_API_KEY` in your `.env` file — no configuration needed.

## Example Prompts

```
"What's trending in movies this week?"
"Find me Thriller movies from 2023"
"Who is Christopher Nolan and what has he directed?"
"Where can I watch Inception in India?"
"Get details for movie ID 550 (Fight Club)"
"Find movies similar to Interstellar"
"What are the trending TV shows right now?"
```

## License

MIT
