/** Run against a local Worker using scripts/fixtures/planning-tmdb.mjs. */
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const base = process.argv[2] || "http://127.0.0.1:8789";
const token = process.env.TMDB_MCP_ACCESS_TOKEN || "fixture-token";
const post = (route, body, auth = true) => fetch(new URL(route, base), {
  method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
});
// Exercise the security-sensitive transport boundary, not just its tool handlers.
assert.equal((await post("/mcp", {}, false)).status, 401);
assert.equal((await fetch(new URL("/mcp", base), { headers: { authorization: "Bearer wrong-token" } })).status, 401);
assert.equal((await fetch(new URL("/not-a-route", base))).status, 404);
const rpcHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" };
const rpcPost = (body) => fetch(new URL("/mcp", base), { method: "POST", headers: rpcHeaders, body });
assert.equal((await rpcPost("{invalid")).status, 400);
const batch = await rpcPost(JSON.stringify(Array.from({ length: 101 }, (_, id) => ({ jsonrpc: "2.0", id, method: "tools/list" }))));
assert.equal(batch.status, 400);
assert.match((await batch.json()).error.message, /Batch must not exceed/);
assert.equal((await rpcPost(JSON.stringify({ padding: "x".repeat(4 * 1024 * 1024) }))).status, 413);
// No Content-Length: verify the limit also applies while consuming streamed input.
const streamed = await fetch(new URL("/mcp", base), {
  method: "POST", headers: rpcHeaders, duplex: "half",
  body: new ReadableStream({ start(controller) {
    for (let i = 0; i < 5; i++) controller.enqueue(new Uint8Array(1024 * 1024).fill(32));
    controller.close();
  } }),
});
assert.equal(streamed.status, 413);
const preflight = await fetch(new URL("/mcp", base), { method: "OPTIONS", headers: { "access-control-request-headers": "authorization, mcp-protocol-version" } });
assert.equal(preflight.status, 204);
assert.match(preflight.headers.get("access-control-allow-headers"), /mcp-protocol-version/);
for (const route of ["/api/release-calendar", "/api/tv-binge-plan", "/api/availability-radar", "/api/streaming-coverage"]) {
  assert.equal((await post(route, {}, false)).status, 401);
  const preflight = await fetch(new URL(route, base), { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("access-control-allow-headers"), /authorization/);
}
assert.equal((await post("/api/tv-binge-plan", { maxHours: -1 })).status, 400);
assert.equal((await post("/api/tv-binge-plan", null)).status, 400);
assert.equal((await post("/api/release-calendar", null)).status, 400);
assert.equal((await post("/api/release-calendar", { services: "Netflix" })).status, 400);
const response = await post("/api/tv-binge-plan", { country: "US", maxHours: 6, services: ["Netflix"], excludeTVIds: [202] });
assert.equal(response.status, 200);
assert.equal(response.headers.get("cache-control"), "no-store");
const plan = await response.json();
assert.deepEqual(plan.picks.map((pick) => pick.id), [101]);
assert.equal(plan.picks[0].status, "Ended");
const calendarResponse = await post("/api/release-calendar", { country: "US", days: "30", recentDays: "7" });
assert.equal(calendarResponse.status, 200);
const calendar = await calendarResponse.json();
assert.ok(calendar.picks.some((pick) => pick.id === 101));
const watchedMovieResponse = await post("/api/concierge", { country: "US", excludeMovieIds: [101] });
assert.equal(watchedMovieResponse.status, 200);
assert.ok((await watchedMovieResponse.json()).picks.every((pick) => pick.id !== 101));
const titles = [{ id: 101, mediaType: "movie", title: "Neon Case" }, { id: 101, mediaType: "tv", title: "Short Mystery" }];
await fetch("http://127.0.0.1:8791/__fixture/radar-mode?mode=baseline", { method: "POST" });
assert.equal((await post("/api/availability-radar", { titles: [] })).status, 400);
const firstRadar = await post("/api/availability-radar", { country: "US", titles, services: ["Prime Video"] });
assert.equal(firstRadar.status, 200);
const baseline = await firstRadar.json();
assert.equal(baseline.summary.baselines, 2);
assert.equal(baseline.summary.newlyOnServices, 0);
await fetch("http://127.0.0.1:8791/__fixture/radar-mode?mode=changed", { method: "POST" });
const secondRadar = await post("/api/availability-radar", { country: "US", titles, services: ["Prime Video"], previousSnapshot: baseline.snapshot });
const delta = await secondRadar.json();
assert.equal(delta.summary.newlyOnServices, 1);
assert.deepEqual(delta.entries[0].newOnServices, ["Amazon Prime Video"]);
await fetch("http://127.0.0.1:8791/__fixture/radar-mode?mode=baseline", { method: "POST" });
assert.equal((await post("/api/streaming-coverage", { titles: [] })).status, 400);
const coverage = await post("/api/streaming-coverage", { country: "US", titles, services: ["Netflix"] });
assert.equal(coverage.status, 200);
const coverageResult = await coverage.json();
assert.equal(coverageResult.current.coveredCount, 2);
assert.equal(coverageResult.suggestion.additions.length, 0);
const client = new Client({ name: "planning-http-test", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", base), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 27);
  const bingeTool = tools.tools.find((tool) => tool.name === "build_tv_binge_plan");
  assert.ok(bingeTool);
  assert.equal(bingeTool.inputSchema.required?.length || 0, 0);
  for (const name of ["get_weekend_watchlist", "plan_watch_party", "recommend_from_taste_profile"]) {
    assert.equal(tools.tools.find((tool) => tool.name === name).inputSchema.properties.excludeMovieIds.type, "array");
  }
  const result = await client.callTool({ name: "build_tv_binge_plan", arguments: { country: "US", maxHours: 6, excludeTVIds: [202] } });
  assert.ok(!result.isError);
  assert.equal(result.structuredContent.picks[0].id, 101);
  assert.match(result.content[0].text, /TV Binge Planner/);
  const radar = await client.callTool({ name: "check_watchlist_availability", arguments: { country: "US", titles } });
  assert.ok(!radar.isError);
  assert.equal(radar.structuredContent.summary.baselines, 2);
  const coverageTool = await client.callTool({ name: "plan_streaming_coverage", arguments: { country: "US", titles, services: ["Netflix"] } });
  assert.ok(!coverageTool.isError);
  assert.equal(coverageTool.structuredContent.current.coveredCount, 2);
  const invalid = await client.callTool({ name: "build_tv_binge_plan", arguments: { maxHours: -1 } });
  assert.equal(invalid.isError, true);
  const concurrent = await Promise.all(Array.from({ length: 3 }, async () => {
    const other = new Client({ name: "parallel-http-test", version: "1.0.0" });
    try {
      await other.connect(new StreamableHTTPClientTransport(new URL("/mcp", base), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
      return (await other.listTools()).tools.length;
    } finally { await other.close(); }
  }));
  assert.deepEqual(concurrent, [27, 27, 27]);
  console.log("Planning HTTP tests passed: auth, CORS, malformed/oversized requests, batch limits, validation, workflows, 27 tools, and concurrent remote MCP clients.");
} finally { await client.close(); }
