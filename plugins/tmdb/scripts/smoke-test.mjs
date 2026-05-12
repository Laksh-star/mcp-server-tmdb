#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const serverEntry = path.join(repoRoot, "dist", "index.js");
const online = process.argv.includes("--online");
const apiKey = process.env.TMDB_API_KEY;

if (!existsSync(serverEntry)) {
  console.error(`Missing built server at ${serverEntry}`);
  console.error("Run `npm install` or `npm run build` from the repo root first.");
  process.exit(1);
}

if (!apiKey) {
  console.error("TMDB_API_KEY is required.");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: "node",
  args: [serverEntry],
  env: {
    ...process.env,
    TMDB_API_KEY: apiKey,
  },
  stderr: "inherit",
});

const client = new Client(
  {
    name: "tmdb-smoke-test",
    version: "1.0.0",
  },
  {
    capabilities: {},
  },
);

try {
  await client.connect(transport);

  const serverInfo = client.getServerVersion();
  console.log(`Connected to ${serverInfo?.name ?? "unknown"} ${serverInfo?.version ?? ""}`.trim());

  const toolsResult = await client.listTools();
  const toolNames = toolsResult.tools.map((tool) => tool.name);
  console.log(`Found ${toolNames.length} tools.`);
  console.log(toolNames.join(", "));

  const requiredTools = [
    "build_franchise_watch_order",
    "search_movies",
    "recommend_from_taste_profile",
    "plan_watch_party",
    "get_trending",
    "get_weekly_trending_by_language",
    "search_tv_shows",
    "search_person",
  ];
  const missingTools = requiredTools.filter((tool) => !toolNames.includes(tool));
  if (missingTools.length > 0) {
    throw new Error(`Missing expected tools: ${missingTools.join(", ")}`);
  }

  if (!online) {
    console.log("Offline smoke test passed.");
    console.log("Re-run with `--online` and a real TMDB API key to hit the TMDB API.");
    process.exit(0);
  }

  const trendingResult = await client.callTool({
    name: "get_trending",
    arguments: { timeWindow: "week" },
  });

  const firstText = trendingResult.content.find((item) => item.type === "text");
  if (!firstText || !("text" in firstText)) {
    throw new Error("Trending response did not include text content.");
  }

  console.log("\nTrending sample:\n");
  console.log(firstText.text.slice(0, 800));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
