import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const args = process.argv.slice(2);
const image = args[0] && !args[0].startsWith("--") ? args[0] : "mcp-server-tmdb:local";
const fixtureBase = args.includes("--fixture-base-url") ? args[args.indexOf("--fixture-base-url") + 1] : undefined;
const user = execFileSync("docker", ["image", "inspect", image, "--format", "{{.Config.User}}"], { encoding: "utf8" }).trim();
assert.ok(user && !["root", "0", "0:0"].includes(user), "Container must run as a non-root user");
const client = new Client({ name: "tmdb-docker-smoke", version: "1.0.0" });
try {
  await client.connect(new StdioClientTransport({ command: "docker", args: ["run", "--rm", "-i", "-e", "TMDB_API_KEY", ...(fixtureBase ? ["-e", "TMDB_BASE_URL"] : []), image], env: { ...process.env, TMDB_API_KEY: "docker-offline-probe", ...(fixtureBase ? { TMDB_BASE_URL: fixtureBase } : {}) }, stderr: "inherit" }));
  const { tools } = await client.listTools();
  for (const name of ["search_movies", "check_watchlist_availability", "plan_streaming_coverage"]) assert.ok(tools.some((tool) => tool.name === name), `Missing ${name}`);
  if (fixtureBase) {
    const result = await client.callTool({ name: "plan_streaming_coverage", arguments: { country: "US", titles: [{ id: 101, mediaType: "movie", title: "Neon Case" }, { id: 101, mediaType: "tv", title: "Short Mystery" }], services: ["Netflix"] } });
    assert.ok(!result.isError);
    assert.equal(result.structuredContent.checkedTitles, 2);
    assert.ok(result.structuredContent.suggestion.coveredCount >= result.structuredContent.current.coveredCount);
    console.log("Container coverage workflow passed against the supplied fixture.");
  }
  console.log(`Docker stdio handshake passed: ${tools.length} tools, non-root user ${user}${fixtureBase ? ", fixture workflow checked" : ", no TMDB request made"}.`);
} finally { await client.close(); }
