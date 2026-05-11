#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const serverEntry = path.join(repoRoot, "dist", "index.js");
const defaultOutputPath = path.join(repoRoot, "examples", "tool-surface-smoke.md");

const args = process.argv.slice(2);
const mcpUrl = valueAfter("--mcp-url");
const outputPath = path.resolve(valueAfter("--out") || defaultOutputPath);
const accessToken = valueAfter("--access-token") || process.env.TMDB_MCP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;

const EXPECTED_TOOLS = [
  "advanced_search",
  "compare_movies",
  "find_where_to_watch",
  "get_movie_details",
  "get_now_playing",
  "get_person_details",
  "plan_watch_party",
  "get_recommendations",
  "get_similar_movies",
  "get_trending",
  "get_trending_tv",
  "get_watch_providers",
  "get_weekend_watchlist",
  "get_weekly_trending_by_language",
  "search_by_genre",
  "search_by_keyword",
  "search_movies",
  "search_person",
  "search_tv_shows",
];

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage() {
  console.log(`Usage:
  npm run build
  node scripts/tool-surface-smoke.mjs
  node scripts/tool-surface-smoke.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp

Options:
  --mcp-url <url>       Remote Cloudflare MCP endpoint. Omit for local stdio.
  --access-token <tok>  Bearer token for protected remote endpoints.
  --out <path>          Markdown artifact path. Defaults to examples/tool-surface-smoke.md.

Environment:
  TMDB_API_KEY is required for local stdio mode.
  TMDB_MCP_ACCESS_TOKEN or ACCESS_TOKEN is used for protected remote MCP URLs.`);
}

function parseSseOrJson(text) {
  if (!text.startsWith("event:")) return JSON.parse(text);
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  return JSON.parse(dataLine?.slice(6) || "{}");
}

async function createRemoteClient(endpoint) {
  let id = 1;

  async function rpc(method, params) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: id++,
        method,
        params,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} failed with ${response.status}: ${text}`);
    }

    const payload = parseSseOrJson(text);
    if (payload.error) {
      throw new Error(`${method} returned error: ${JSON.stringify(payload.error)}`);
    }
    return payload.result;
  }

  const initializeResult = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "tmdb-tool-surface-smoke",
      version: "1.0.0",
    },
  });

  return {
    mode: "remote",
    serverName: initializeResult.serverInfo?.name || "unknown",
    listTools() {
      return rpc("tools/list", {});
    },
    callTool(name, toolArgs) {
      return rpc("tools/call", { name, arguments: toolArgs });
    },
    async close() {},
  };
}

async function createLocalClient() {
  if (!existsSync(serverEntry)) {
    throw new Error(`Missing built server at ${serverEntry}. Run npm install and npm run build first.`);
  }
  if (!process.env.TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is required in local mode. Use `set -a && source ./.env && set +a` or export it.");
  }

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverEntry],
    env: process.env,
    stderr: "inherit",
  });
  const client = new Client(
    {
      name: "tmdb-tool-surface-smoke",
      version: "1.0.0",
    },
    { capabilities: {} },
  );
  await client.connect(transport);

  return {
    mode: "local",
    serverName: "mcp-server-tmdb",
    listTools() {
      return client.listTools();
    },
    callTool(name, toolArgs) {
      return client.callTool({ name, arguments: toolArgs });
    },
    close() {
      return client.close().catch(() => {});
    },
  };
}

function textContent(result) {
  if (result.isError) {
    const message = result.content
      ?.filter((content) => content.type === "text" && "text" in content)
      .map((content) => content.text)
      .join("\n") || "MCP tool returned an error.";
    throw new Error(message);
  }

  const item = result.content?.find((content) => content.type === "text" && "text" in content);
  if (!item) {
    throw new Error("MCP tool response did not include text content.");
  }
  return item.text.trim();
}

async function callToolText(client, name, toolArgs, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return textContent(await client.callTool(name, toolArgs));
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const message = error instanceof Error ? error.message : String(error);
      if (!/ECONNRESET|ETIMEDOUT|fetch failed|network|TMDB API request failed/i.test(message)) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`${label} did not include expected text: ${needle}`);
  }
}

function excerpt(text, maxLines = 12) {
  return text.split("\n").slice(0, maxLines).join("\n");
}

function fenced(text) {
  return `\`\`\`text\n${text.replaceAll("```", "'''")}\n\`\`\``;
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const client = mcpUrl ? await createRemoteClient(mcpUrl) : await createLocalClient();
  try {
    const toolsResult = await client.listTools();
    const actualTools = toolsResult.tools.map((tool) => tool.name).sort();
    const missing = EXPECTED_TOOLS.filter((tool) => !actualTools.includes(tool));
    const unexpected = actualTools.filter((tool) => !EXPECTED_TOOLS.includes(tool));
    if (missing.length > 0) {
      throw new Error(`Missing expected tools: ${missing.join(", ")}`);
    }

    const compareText = await callToolText(client, "compare_movies", {
      movieIds: ["603", "155"],
      country: "US",
    });
    assertIncludes(compareText, "Quick decision", "compare_movies");

    const whereText = await callToolText(client, "find_where_to_watch", {
      titles: ["The Matrix", "The Dark Knight"],
      country: "US",
      services: ["HBO", "Netflix"],
    });
    assertIncludes(whereText, "Preferred-service matches", "find_where_to_watch");

    const conciergeText = await callToolText(client, "get_weekend_watchlist", {
      mood: "thriller",
      country: "US",
      language: "any",
      runtime: "150",
      minRating: "6.5",
      services: ["Netflix", "Prime Video"],
    });
    assertIncludes(conciergeText, "Weekend Watch Concierge picks", "get_weekend_watchlist");

    const partyText = await callToolText(client, "plan_watch_party", {
      moods: ["crowd", "thriller"],
      groupSize: "5",
      country: "US",
      language: "any",
      runtime: "135",
      minRating: "6.8",
      services: ["Netflix", "Prime Video"],
      avoidTitles: ["The Matrix"],
    });
    assertIncludes(partyText, "Watch Party Planner", "plan_watch_party");

    const generatedAt = new Date().toISOString();
    const artifact = [
      "# TMDB MCP Tool Surface Smoke",
      "",
      `Generated: ${generatedAt}`,
      `Mode: ${client.mode}`,
      `Server: ${client.serverName}`,
      `Endpoint: ${mcpUrl || "local stdio dist/index.js"}`,
      "",
      "## Tool Contract",
      "",
      `Expected tools: ${EXPECTED_TOOLS.length}`,
      `Actual tools: ${actualTools.length}`,
      unexpected.length > 0 ? `Unexpected tools: ${unexpected.join(", ")}` : "Unexpected tools: none",
      "",
      "```text",
      actualTools.join("\n"),
      "```",
      "",
      "## Workflow Smoke Results",
      "",
      "### compare_movies",
      "",
      fenced(excerpt(compareText, 18)),
      "",
      "### find_where_to_watch",
      "",
      fenced(excerpt(whereText, 18)),
      "",
      "### get_weekend_watchlist",
      "",
      fenced(excerpt(conciergeText, 18)),
      "",
      "### plan_watch_party",
      "",
      fenced(excerpt(partyText, 18)),
      "",
    ].join("\n");

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, artifact);

    console.log(`Tool contract OK: ${actualTools.length} tools.`);
    console.log("Workflow calls OK: compare_movies, find_where_to_watch, get_weekend_watchlist, plan_watch_party.");
    console.log(`Wrote ${outputPath}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
