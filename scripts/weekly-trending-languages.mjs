#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const serverEntry = path.join(repoRoot, "dist", "index.js");

const args = process.argv.slice(2);
const mcpUrl = valueAfter("--mcp-url");
const accessToken = valueAfter("--access-token") || process.env.TMDB_MCP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage() {
  console.log(`Usage:
  npm run demo:weekly-trending
  node scripts/weekly-trending-languages.mjs --mcp-url <https://.../mcp>

Environment:
  TMDB_API_KEY is required for the local stdio server.
  TMDB_MCP_ACCESS_TOKEN or ACCESS_TOKEN is used for protected remote MCP URLs.`);
}

async function callRemoteTool(endpoint) {
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

    const payload = text.startsWith("event:")
      ? JSON.parse(text.split("\n").find((line) => line.startsWith("data: "))?.slice(6) || "{}")
      : JSON.parse(text);

    if (payload.error) {
      throw new Error(`${method} returned error: ${JSON.stringify(payload.error)}`);
    }

    return payload.result;
  }

  await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "tmdb-weekly-trending-language-demo",
      version: "1.0.0",
    },
  });

  return rpc("tools/call", {
    name: "get_weekly_trending_by_language",
    arguments: {},
  });
}

async function callLocalTool() {
  if (!existsSync(serverEntry)) {
    throw new Error(`Missing built server at ${serverEntry}. Run npm install or npm run build first.`);
  }

  if (!process.env.TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is required. Use `set -a && source ./.env && set +a` or export it.");
  }

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverEntry],
    env: process.env,
    stderr: "inherit",
  });

  const client = new Client(
    {
      name: "tmdb-weekly-trending-language-demo",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  try {
    await client.connect(transport);
    return await client.callTool({
      name: "get_weekly_trending_by_language",
      arguments: {},
    });
  } finally {
    await client.close().catch(() => {});
  }
}

function printText(result) {
  const item = result.content?.find((content) => content.type === "text" && "text" in content);
  if (!item) {
    throw new Error("MCP tool response did not include text content.");
  }
  console.log(item.text);
}

if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

try {
  const result = mcpUrl ? await callRemoteTool(mcpUrl) : await callLocalTool();
  printText(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
