# Weekend Watch Concierge

Weekend Watch Concierge is a Cloudflare Worker app and remote MCP tool built on this repo's TMDB server.

It has two user surfaces:

- Browser app: solo picks or Watch Party plans from mood, country, language, runtime, rating, streaming-service, group-size, family-safe, and avoided-title filters.
- Remote MCP tools: `get_weekend_watchlist`, `plan_watch_party`, `build_franchise_watch_order`, `recommend_from_taste_profile`, and `build_person_watch_path`, so agents can ask for the same shortlist, group plan, franchise guide, taste-based recommendations, or person watch path through `/mcp`.

## Screenshots

Blank state:

![Weekend Watch Concierge blank state](assets/weekend-watch-concierge-home.png)

Generated desktop results:

![Weekend Watch Concierge desktop results](assets/weekend-watch-concierge-results.png)

Watch Party mode:

![Weekend Watch Concierge Watch Party mode](assets/weekend-watch-concierge-watch-party.png)

Mobile layout:

![Weekend Watch Concierge mobile layout](assets/weekend-watch-concierge-mobile.png)

## Live Deployment

Browser app:

```text
https://tmdb-mcp.<your-workers-subdomain>.workers.dev/
```

Remote MCP endpoint:

```text
https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp
```

Health check:

```text
https://tmdb-mcp.<your-workers-subdomain>.workers.dev/health
```

Do not commit personal deployment URLs for public repos. Keep the concrete Worker URL in local notes or your Cloudflare dashboard.

## Access Token

The deployed Worker is protected by the `ACCESS_TOKEN` Cloudflare secret. The local copy of that token is stored in an ignored file:

```text
/Users/ln-mini/Downloads/mcp-server-tmdb/.cloudflare-access-token
```

Use the same token for:

- The deployed browser app's **Access token** field.
- `POST /api/concierge` requests.
- `POST /mcp` requests.
- MCP smoke tests or remote clients that can send an authorization header.

The required header is:

```text
Authorization: Bearer <access-token>
```

Do not commit the token. Rotate it by generating a new token and running:

```bash
npx wrangler secret put ACCESS_TOKEN
```

## Local Development

Start the Worker locally:

```bash
npm run worker:dev
```

The `worker:dev` script runs `scripts/sync-dev-vars.mjs`, which copies values from `.env` into an ignored `.dev.vars` file for Wrangler.

Local browser app:

```text
http://127.0.0.1:8787/
```

Local MCP endpoint:

```text
http://127.0.0.1:8787/mcp
```

Local development does not require an access token unless `ACCESS_TOKEN` is present in `.env`.

## Browser App Flow

1. Open the deployed app.
2. Paste the token from `.cloudflare-access-token` into **Access token**.
3. Pick mood, country, language, runtime, minimum rating, and services.
4. Click **Find picks**.

The app calls:

```text
POST /api/concierge
```

and receives ranked picks with title, poster, year, rating, runtime, genres, cast, director, provider data, and ranking reasons.

## MCP Tool

Agents can call:

```text
get_weekend_watchlist
```

Inputs:

- `mood`: `crowd`, `thriller`, `thoughtful`, `funny`, `family`, or `mindbend`
- `country`: watch-provider region such as `IN`, `US`, or `GB`
- `language`: original language code such as `en`, `hi`, `ta`, `te`, `ko`, or `any`
- `runtime`: maximum runtime in minutes, or `any`
- `minRating`: minimum TMDB rating
- `services`: preferred streaming services such as `Netflix` or `Prime Video`

Example prompt for an MCP client:

```text
Find me Hindi thrillers under 2.5 hours available in India on Netflix or Prime.
```

## Smoke Tests

Local concierge API:

```bash
npm run smoke:concierge
```

Deployed concierge API:

```bash
TMDB_MCP_ACCESS_TOKEN="$(cat .cloudflare-access-token)" node scripts/concierge-smoke.mjs https://tmdb-mcp.<your-workers-subdomain>.workers.dev
```

Local MCP endpoint:

```bash
node scripts/remote-mcp-smoke.mjs http://127.0.0.1:8787/mcp --call-concierge
```

Deployed MCP endpoint:

```bash
TMDB_MCP_ACCESS_TOKEN="$(cat .cloudflare-access-token)" node scripts/remote-mcp-smoke.mjs https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --call-concierge
```

Expected deployed checks:

- `GET /health` returns `hasAccessToken: true` and `hasTMDBKey: true`.
- Unauthenticated `POST /api/concierge` returns `401`.
- Authenticated concierge smoke returns ranked picks.
- Authenticated MCP smoke lists `get_weekend_watchlist` and successfully calls it.

## Cloudflare Commands

Set secrets:

```bash
npx wrangler secret put TMDB_API_KEY
npx wrangler secret put ACCESS_TOKEN
```

Bundle check:

```bash
npm run worker:dry-run
```

Deploy:

```bash
npm run worker:deploy
```

## Key Files

- `src/worker.ts`: Worker routing, MCP tool registration, auth checks.
- `src/concierge.ts`: TMDB data fetching, ranking, watch-provider enrichment.
- `src/concierge-app.ts`: Browser UI HTML, CSS, and client-side behavior.
- `scripts/sync-dev-vars.mjs`: Syncs `.env` into `.dev.vars` for local Wrangler.
- `scripts/concierge-smoke.mjs`: API smoke test.
- `scripts/remote-mcp-smoke.mjs`: MCP endpoint smoke test.
