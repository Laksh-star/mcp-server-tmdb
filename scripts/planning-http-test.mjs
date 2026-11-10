/** Run against a local Worker using scripts/fixtures/planning-tmdb.mjs. */
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const base = process.argv[2] || "http://127.0.0.1:8789";
const token = process.env.TMDB_MCP_ACCESS_TOKEN || "fixture-token";
const post = (route, body, auth = true) => fetch(new URL(route, base), {
  method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
});
for (const route of ["/api/release-calendar", "/api/tv-binge-plan"]) {
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
const client = new Client({ name: "planning-http-test", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", base), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  const tools = await client.listTools();
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
  const invalid = await client.callTool({ name: "build_tv_binge_plan", arguments: { maxHours: -1 } });
  assert.equal(invalid.isError, true);
  console.log("Planning HTTP tests passed: auth, CORS, validation, calendar, viewing history, and remote MCP.");
} finally { await client.close(); }
