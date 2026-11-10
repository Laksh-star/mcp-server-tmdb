import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { checkWatchlistAvailability } from "../dist/availability-radar.js";
let mode = "baseline", requests = 0;
const provider = (id, name) => ({ provider_id: id, provider_name: name });
const fixture = createServer((req, res) => {
  requests++;
  if (mode === "failed") { res.writeHead(503); res.end(); return; }
  const isTV = req.url.startsWith("/tv/");
  const region = mode === "changed" && !isTV
    ? { flatrate: [provider(9, "Amazon Prime Video")], rent: [provider(2, "Apple TV Store")] }
    : { flatrate: [provider(8, mode === "renamed" ? "NETFLIX" : "Netflix")], rent: [] };
  const results = mode === "missing" ? {} : { US: mode === "empty" ? { flatrate: [], rent: [], buy: [] } : mode === "link-only" ? { link: "https://www.themoviedb.org/movie/1/watch" } : region };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(mode === "malformed" ? { invalid: true } : { results }));
});
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
const env = { TMDB_API_KEY: "fixture-key", TMDB_BASE_URL: `http://127.0.0.1:${fixture.address().port}` };
const titles = [{ id: 1, mediaType: "movie", title: "A Movie" }, { id: 1, mediaType: "tv", title: "A Series" }];
let client;
try {
  const baseline = await checkWatchlistAvailability(env, { country: "US", titles, services: ["Prime Video"] });
  assert.equal(baseline.summary.baselines, 2);
  assert.equal(baseline.summary.newlyOnServices, 0, "First observations must not count as new arrivals");
  assert.equal(baseline.snapshot.items.length, 2, "Movie/TV IDs must stay separate");
  mode = "changed";
  const changed = await checkWatchlistAvailability(env, { country: "US", titles, services: ["Prime Video"], previousSnapshot: baseline.snapshot });
  assert.equal(changed.summary.changed, 1);
  assert.equal(changed.summary.newlyOnServices, 1);
  assert.deepEqual(changed.entries[0].newOnServices, ["Amazon Prime Video"]);
  assert.equal(changed.entries[0].changes.find((x) => x.category === "streaming").removed[0].id, 8);
  assert.equal(changed.entries[0].changes.find((x) => x.category === "rent").added[0].id, 2);
  assert.equal(changed.entries[1].status, "unchanged");
  const repeat = await checkWatchlistAvailability(env, { country: "US", titles, previousSnapshot: changed.snapshot });
  assert.equal(repeat.summary.changed, 0, "Repeated checks should not repeat arrivals");
  mode = "renamed";
  const rename = await checkWatchlistAvailability(env, { country: "US", titles, previousSnapshot: baseline.snapshot });
  assert.equal(rename.summary.changed, 0, "Provider IDs, not display-name case, define changes");
  for (mode of ["failed", "missing", "malformed", "link-only"]) {
    const unavailable = await checkWatchlistAvailability(env, { country: "US", titles, previousSnapshot: baseline.snapshot });
    assert.equal(unavailable.summary.unchecked, 2);
    assert.equal(unavailable.summary.changed, 0);
    assert.deepEqual(unavailable.snapshot, baseline.snapshot, mode + " must preserve last successful observations");
  }
  mode = "empty";
  const empty = await checkWatchlistAvailability(env, { country: "US", titles, previousSnapshot: baseline.snapshot });
  assert.equal(empty.summary.changed, 2, "Explicit empty listings can record observed removals");
  mode = "baseline";
  const countryChange = await checkWatchlistAvailability(env, { country: "IN", titles, previousSnapshot: baseline.snapshot });
  assert.equal(countryChange.summary.changed, 0);
  assert.equal(countryChange.snapshot.items.length, 0);
  assert.match(countryChange.notes[0], /Country changed/);
  const deduped = await checkWatchlistAvailability(env, { country: "US", titles: [titles[0], titles[0]] });
  assert.equal(deduped.entries.length, 1);
  const count = requests;
  await assert.rejects(checkWatchlistAvailability(env, { titles: Array(51).fill(titles[0]) }));
  await assert.rejects(checkWatchlistAvailability(env, { titles: [{ id: -1, mediaType: "movie" }] }));
  await assert.rejects(checkWatchlistAvailability(env, { titles, previousSnapshot: { version: 99 } }));
  await assert.rejects(checkWatchlistAvailability({}, { titles }), /TMDB_API_KEY/);
  assert.equal(requests, count, "Invalid inputs must fail before network calls");

  client = new Client({ name: "radar-offline-test", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: { ...process.env, ...env }, stderr: "inherit" }));
  const listed = await client.listTools();
  const tool = listed.tools.find((tool) => tool.name === "check_watchlist_availability");
  assert.ok(tool);
  assert.deepEqual(tool.inputSchema.required, ["titles"]);
  const result = await client.callTool({ name: tool.name, arguments: { country: "US", titles } });
  assert.ok(!result.isError);
  assert.equal(result.structuredContent.summary.baselines, 2);
  assert.match(result.content[0].text, /Personal Availability Radar/);
  console.log("Radar offline tests passed: baseline/deltas, provider IDs, service matches, movie/TV separation, failures, country changes, validation, and local MCP.");
} finally {
  if (client) await client.close();
  fixture.close();
  await once(fixture, "close");
}
