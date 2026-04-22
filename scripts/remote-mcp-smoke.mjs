#!/usr/bin/env node

const endpoint = process.argv[2];

if (!endpoint) {
  console.error("Usage: node scripts/remote-mcp-smoke.mjs <mcp-url>");
  process.exit(1);
}

async function rpc(method, params, id = 1) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} failed with ${response.status}: ${text}`);
  }

  const payload = text.startsWith("event:")
    ? JSON.parse(text.split("\n").find((line) => line.startsWith("data: "))?.slice(6) || "{}")
    : JSON.parse(text);

  if (payload.error) {
    throw new Error(`${method} returned error: ${JSON.stringify(payload.error)}`);
  }

  return payload.result;
}

const initializeResult = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: {
    name: "tmdb-remote-smoke",
    version: "1.0.0",
  },
});

console.log(`Connected to ${initializeResult.serverInfo?.name || "unknown"}`);

const toolsResult = await rpc("tools/list", {}, 2);
const toolNames = toolsResult.tools.map((tool) => tool.name);
console.log(`Found ${toolNames.length} tools.`);
console.log(toolNames.join(", "));

const required = ["search_movies", "get_trending", "search_tv_shows", "search_person"];
const missing = required.filter((tool) => !toolNames.includes(tool));
if (missing.length > 0) {
  throw new Error(`Missing expected tools: ${missing.join(", ")}`);
}
