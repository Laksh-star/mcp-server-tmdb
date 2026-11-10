# Planning workflow verification

The user story is browser planning → authenticated Worker API → TMDB → rendered results,
then browser-local saved state → subsequent recommendation exclusions. Both local stdio
and remote Streamable HTTP MCP expose the same TV planner.

## Automated checks

```sh
npm test
TMDB_API_KEY=dummy npm run smoke:plugin
npm run worker:dry-run
```

`npm test` verifies watched exclusions for solo/party/taste picks, TV time/status/service/region
constraints, missing-runtime labels, errors, watchlist import validation/merging, browser
script syntax, and the local MCP TV contract.

For deterministic HTTP and remote MCP tests, start these in separate terminals:

```sh
node scripts/fixtures/planning-tmdb.mjs --serve
```

```sh
npx wrangler dev --config scripts/fixtures/wrangler.jsonc --port 8789
```

Then run:

```sh
node scripts/planning-http-test.mjs
```

This fixture uses only the literal dummy values `fixture-key` and `fixture-token`.
It never contacts TMDB. The HTTP checks verify authorization, preflight CORS, invalid inputs,
calendar results, watched exclusions, and the remote MCP TV schema/results.

## Browser walkthrough

Open `http://127.0.0.1:8789/` and enter `fixture-token` in Access token.

1. Open Release Calendar and build a calendar. Save Neon Case.
2. Open TV Binge Planner and find a series. Ended results include Short Mystery and Unknown Runtime; Cancelled Mystery is omitted. The missing runtime assumption is shown.
3. Save a TV result. Mark entries Watched in My Watchlist and reload; saved state remains.
4. Mark Neon Case Liked and select Use saved movie tastes. Recommend returns other movies.
5. Run the TV planner again; watched TV results are excluded.
6. Export JSON, then import it: entries remain unique. Import an invalid version and verify the existing list is unchanged.
7. Open another tab on the same origin and change a status; both lists update.
8. Check a 390px viewport; the list and controls do not overflow horizontally.

## Evidence from 2026-11-10

Passed build, offline tests, plugin discovery (25 tools), HTTP/remote MCP tests, and Worker
bundle dry run. Browser checks passed for calendar/TV rendering, saved-state reload,
movie/TV exclusions, saved taste loading, import/export, movie/TV ID separation, escaped
imported titles, quota failure preserving state, cross-tab updates, and a 390px viewport.
No browser JavaScript exceptions were observed in the fixture walkthrough. A missing
favicon returns 404 independently of the planning flows.

The screenshots in the README were visually inspected and show fixture data.

Live TMDB access was intermittent from this machine, including connection resets from the
local Worker. A loopback Node forwarder also encountered upstream failures. Live discovery
and detail responses confirmed TMDB status 3 is Ended, status 4 is Canceled, and type 2 is
Miniseries; the regression test checks the Ended discovery code. A complete live planning
smoke run is **not verified**. Run `npm run smoke:tools` with a real TMDB key and the same
script against the deployed endpoint after release. A merge alone does not redeploy the Worker.
