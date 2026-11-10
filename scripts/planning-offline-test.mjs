import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import vm from "node:vm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { buildTVBingePlan } from "../dist/tv-binge.js";
import { watchlistModelScript } from "../dist/watchlist-app.js";
import { recommendFromTasteProfile } from "../dist/taste.js";
import { renderConciergeApp } from "../dist/concierge-app.js";

const series = {
  1: { name: "Short Mystery", status: "Ended", number_of_episodes: 6, episode_run_time: [40, 50] },
  2: { name: "Cancelled Mystery", status: "Canceled", number_of_episodes: 6, episode_run_time: [45] },
  3: { name: "Long Mystery", status: "Ended", number_of_episodes: 100, episode_run_time: [45] },
  4: { name: "Unknown Runtime", status: "Ended", number_of_episodes: 4, episode_run_time: [] },
  5: { name: "Still Returning", status: "Returning Series", number_of_episodes: 6, episode_run_time: [45] },
  6: { name: "Add-on Only", status: "Ended", number_of_episodes: 6, episode_run_time: [45] },
};
let failDetails = false;
const requests = [];
const fixture = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  requests.push(url.pathname);
  let payload;
  const movie = (id) => ({ id, title: "Movie " + id, release_date: "2020-01-01", vote_average: 8, genres: [{ id: 80, name: "Crime" }], runtime: 90 });
  if (url.pathname === "/search/movie") payload = { results: [movie(10)] };
  if (/^\/movie\/10\/(recommendations|similar)$/.test(url.pathname)) payload = { results: [movie(11), movie(12)] };
  const movieMatch = url.pathname.match(/^\/movie\/(\d+)$/);
  if (movieMatch) payload = movie(Number(movieMatch[1]));
  if (url.pathname === "/genre/tv/list") payload = { genres: [{ id: 9648, name: "Mystery" }, { id: 80, name: "Crime" }] };
  if (url.pathname === "/discover/tv") {
    if (url.searchParams.has("with_status")) assert.equal(url.searchParams.get("with_status"), "3", "TMDB status 3 is Ended");
    payload = { results: Object.keys(series).map((id) => ({ id: Number(id) })), total_pages: 1 };
  }
  const match = url.pathname.match(/^\/tv\/(\d+)$/);
  if (match && !failDetails) {
    const id = Number(match[1]);
    payload = {
      id, ...series[id], number_of_seasons: 1, original_language: "en", vote_average: 8, first_air_date: "2020-01-01",
      genres: [{ id: 9648, name: "Mystery" }],
      "watch/providers": { results: { US: { flatrate: [{ provider_name: id === 6 ? "Netflix Standard with Ads" : "Netflix" }] } } },
    };
  }
  res.writeHead(payload ? 200 : 404, { "content-type": "application/json" });
  res.end(JSON.stringify(payload || { error: "not found" }));
});
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
const env = { TMDB_API_KEY: "fixture-key", TMDB_BASE_URL: `http://127.0.0.1:${fixture.address().port}` };
let client;
try {
  const plan = await buildTVBingePlan(env, { country: "US", genre: "thriller", maxHours: 6, minutesPerDay: 120, services: ["Netflix"] });
  assert.deepEqual(plan.picks.map((pick) => pick.id), [4, 1]);
  assert.equal(plan.picks[1].estimatedRuntimeMinutes, 270);
  assert.equal(plan.picks[1].estimatedDays, 3);
  assert.equal(plan.picks[0].runtimeBasis, "assumed-45-minutes");
  assert.match(plan.picks[0].reasons.join(" "), /assumes 45/);
  assert.match(plan.notes.join(" "), /no TV Thriller genre/);
  assert.ok(plan.picks.every((pick) => pick.status === "Ended"));

  const excluded = await buildTVBingePlan(env, { country: "US", excludeTVIds: [1, 4], maxHours: 6, services: ["Netflix"] });
  assert.equal(excluded.picks.length, 0);
  assert.match(excluded.notes.join(" "), /No matches/);
  const abroad = await buildTVBingePlan(env, { country: "IN", services: ["Netflix"] });
  assert.equal(abroad.picks.length, 0, "Availability must match the requested region");
  const returning = await buildTVBingePlan(env, { country: "US", completedOnly: false, maxHours: 6 });
  assert.ok(returning.picks.some((pick) => pick.id === 5));
  const narrow = await buildTVBingePlan(env, { country: "US", language: "hi", maxHours: 6 });
  assert.equal(narrow.picks.length, 0);
  const count = requests.length;
  await assert.rejects(buildTVBingePlan(env, { maxHours: -1 }));
  await assert.rejects(buildTVBingePlan(env, { services: "Netflix" }));
  assert.equal(requests.length, count, "Invalid input should fail before network calls");
  await assert.rejects(buildTVBingePlan(env, { genre: "invented genre" }), /Unknown TV genre/);
  failDetails = true;
  await assert.rejects(buildTVBingePlan(env, {}), /TV details are unavailable/);
  failDetails = false;

  const tastes = await recommendFromTasteProfile(env, { likedTitles: ["Movie 10"], excludeMovieIds: [11] });
  assert.deepEqual(tastes.picks.map((pick) => pick.id), [12]);

  const model = vm.createContext({});
  vm.runInContext(watchlistModelScript(), model);
  const entry = { id: 1, mediaType: "movie", title: "A Movie", year: "2020", status: "watched", preference: "liked", updatedAt: "2026-01-01T00:00:00Z" };
  const current = model.parseWatchlist({ version: 1, items: [entry] });
  const imported = model.parseWatchlist({ version: 1, items: [{ ...entry, mediaType: "tv", title: "A Series", unexpectedSecret: "discard" }] });
  const merged = model.mergeWatchlists(current, imported);
  assert.equal(merged.items.length, 2, "Movie and TV IDs must stay distinct");
  assert.equal(merged.items[1].unexpectedSecret, undefined);
  assert.equal(model.mergeWatchlists(current, current).items.length, 1, "Imports must not create duplicates");
  const older = model.parseWatchlist({ version: 1, items: [{ ...entry, status: "watchlist", updatedAt: "2025-01-01T00:00:00Z" }] });
  assert.equal(model.mergeWatchlists(current, older).items[0].status, "watched", "Older imports must not overwrite newer state");
  for (const bad of [
    { version: 99, items: [] }, { version: 1, items: [{ ...entry, id: -1 }] },
    { version: 1, items: [{ ...entry, title: null }] }, { version: 1, items: [{ ...entry, status: "invented" }] },
    { version: 1, items: [{ ...entry, updatedAt: "invalid" }] }, { version: 1, items: Array(2001).fill(entry) },
  ]) assert.throws(() => model.parseWatchlist(bad));

  const html = renderConciergeApp();
  for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script);
  assert.ok(html.includes('id="calendar-form"') && html.includes('id="binge-form"') && html.includes('id="library-output"'));

  client = new Client({ name: "planning-offline-test", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: { ...process.env, ...env }, stderr: "inherit" }));
  const tools = await client.listTools();
  const tool = tools.tools.find((tool) => tool.name === "build_tv_binge_plan");
  assert.ok(tool);
  assert.equal(tool.inputSchema.properties.maxHours.type, "number");
  assert.equal(tool.inputSchema.required?.length || 0, 0, "Defaulted planner inputs must be optional in the MCP schema");
  const result = await client.callTool({ name: tool.name, arguments: { country: "US", maxHours: 6, services: ["Netflix"] } });
  assert.ok(!result.isError);
  assert.match(result.content[0].text, /TV Binge Planner/);
  assert.equal(result.structuredContent.picks.length, 2);
  const invalid = await client.callTool({ name: tool.name, arguments: { maxHours: -1 } });
  assert.equal(invalid.isError, true);
  console.log("Planning offline tests passed: constraints, runtime estimates, region/service matching, failures, browser syntax, and MCP contract.");
} finally {
  if (client) await client.close();
  fixture.close();
  await once(fixture, "close");
}
