# TMDB Codex Plugin

This repo includes a local Codex plugin for the TMDB MCP server.

## What it wires up

- Plugin manifest: `plugins/tmdb/.codex-plugin/plugin.json`
- MCP config: `plugins/tmdb/.mcp.json`
- Marketplace entry: `.agents/plugins/marketplace.json`
- Smoke test: `plugins/tmdb/scripts/smoke-test.mjs`

## Prerequisites

- Node.js installed
- Dependencies installed in this repo
- A TMDB API key from `https://www.themoviedb.org/settings/api`

## Local setup

1. Build the server:

```bash
npm install
```

2. Set your TMDB API key in one of these ways:

- Create a repo `.env` file from `.env.example`
- Or export it when running local checks:

```bash
export TMDB_API_KEY=your_api_key_here
```

3. Install the local integrations for Codex and Claude Desktop:

```bash
npm run install:local
```

This writes:

- `~/.codex/config.toml` with an `mcp_servers.tmdb_local` entry
- Codex plugin marketplace/cache data under `~/.codex/.tmp/plugins` and `~/.codex/plugins/cache/openai-curated/tmdb`
- `~/Library/Application Support/Claude/claude_desktop_config.json` with a `tmdb-local` server entry

## Test outside Codex

Offline smoke test:

```bash
TMDB_API_KEY=dummy node plugins/tmdb/scripts/smoke-test.mjs
```

Online smoke test against TMDB:

```bash
TMDB_API_KEY=your_api_key_here node plugins/tmdb/scripts/smoke-test.mjs --online
```

The online run should connect to the server, list tools, and print a short sample from the `get_trending` tool.

## Weekly trending language demo

The repo also includes a demo runner for the `get_weekly_trending_by_language` tool. It fetches live weekly trending movies and groups the current TMDB first page into English, Hindi, and Telugu using `original_language`.

Local stdio MCP server:

```bash
npm run build
set -a && source ./.env && set +a && npm run demo:weekly-trending
```

Remote deployed MCP endpoint after deploying this version of the Worker:

```bash
TMDB_MCP_ACCESS_TOKEN=<your-access-token> node scripts/weekly-trending-languages.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp
```

## Test inside Codex

1. Open this repo as the workspace.
2. Run `npm run install:local`.
3. Restart Codex if it was already open.
4. Ask Codex something like:
   - `What movies are trending this week?`
   - `Find thriller movies from 2023`
   - `Where can I watch Inception in India?`

If the install worked, a fresh Codex session should list `TMDB` in the available plugins and expose the plugin namespace `mcp__tmdb__`. You may also still see the direct server namespace `mcp__tmdb_local__`, since the repo launcher is registered separately as a plain MCP server.

## Test inside Claude Desktop

1. Run `npm run install:local`.
2. Restart Claude Desktop.
3. Open a chat and ask:
   - `What movies are trending this week?`
   - `Who is Christopher Nolan and what has he directed?`
   - `Where can I watch Inception in India?`

Claude Desktop should launch this repo's MCP server through `plugins/tmdb/scripts/run-server.sh`.

## Remote Claude/Cowork connector

For Claude, Cowork, and other clients that support remote MCP URLs, deploy the Cloudflare Worker entrypoint from the repo root instead:

```bash
npx wrangler login
npx wrangler secret put TMDB_API_KEY
npm run worker:dry-run
npm run worker:deploy
```

Then add the deployed `/mcp` URL as a Claude custom connector:

```text
https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp
```

The remote Worker is separate from this local plugin package. It is authless by default for personal testing, so add OAuth or Cloudflare Access before sharing the URL.
