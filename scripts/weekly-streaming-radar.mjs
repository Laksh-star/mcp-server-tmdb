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
const defaultOutputPath = path.join(repoRoot, "examples", "weekly-streaming-radar.md");

const args = process.argv.slice(2);
const mcpUrl = valueAfter("--mcp-url");
const outputPath = path.resolve(valueAfter("--out") || defaultOutputPath);
const country = (valueAfter("--country") || "US").toUpperCase();
const accessToken = valueAfter("--access-token") || process.env.TMDB_MCP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage() {
  console.log(`Usage:
  npm run build
  node scripts/weekly-streaming-radar.mjs --country US
  node scripts/weekly-streaming-radar.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --country IN

Options:
  --mcp-url <url>       Remote Cloudflare MCP endpoint. Omit for local stdio.
  --access-token <tok>  Bearer token for protected remote endpoints.
  --country <code>      Watch-provider country, defaults to US.
  --out <path>          Markdown artifact path. Defaults to examples/weekly-streaming-radar.md.

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

  await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "tmdb-weekly-streaming-radar",
      version: "1.0.0",
    },
  });

  return {
    mode: "remote",
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
      name: "tmdb-weekly-streaming-radar",
      version: "1.0.0",
    },
    { capabilities: {} },
  );
  await client.connect(transport);

  return {
    mode: "local",
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

function fenced(text) {
  return `\`\`\`text\n${text.replaceAll("```", "'''")}\n\`\`\``;
}

function excerpt(text, maxLines = 18) {
  return text.split("\n").slice(0, maxLines).join("\n");
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const client = mcpUrl ? await createRemoteClient(mcpUrl) : await createLocalClient();
  try {
    const [
      trendingMovies,
      trendingTv,
      languageTrends,
      actionReady,
      familySafe,
      tasteProbe,
    ] = await Promise.all([
      callToolText(client, "get_trending", { timeWindow: "week" }),
      callToolText(client, "get_trending_tv", { timeWindow: "week" }),
      callToolText(client, "get_weekly_trending_by_language", {}),
      callToolText(client, "get_weekend_watchlist", {
        mood: "crowd",
        country,
        language: "any",
        runtime: "150",
        minRating: "6.7",
        services: ["Netflix", "Prime Video"],
      }),
      callToolText(client, "get_weekend_watchlist", {
        mood: "family",
        country,
        language: "any",
        runtime: "130",
        minRating: "6.5",
        services: ["Netflix", "Prime Video"],
        familySafe: "true",
      }),
      callToolText(client, "recommend_from_taste_profile", {
        likedTitles: ["The Matrix", "Inception"],
        dislikedTitles: ["The Notebook"],
        country,
        services: ["Netflix", "Prime Video"],
        language: "any",
        runtime: "160",
        minRating: "6.7",
        maxResults: "5",
      }),
    ]);

    const generatedAt = new Date().toISOString();
    const artifact = [
      "# Weekly Streaming Radar",
      "",
      `Generated: ${generatedAt}`,
      `Mode: ${client.mode}`,
      `Country: ${country}`,
      `Endpoint: ${mcpUrl || "local stdio dist/index.js"}`,
      "",
      "## What To Scan First",
      "",
      "1. Use the action-ready watchlist for immediate viewing decisions.",
      "2. Use the family-safe section when the room includes younger viewers.",
      "3. Use taste-profile results when the viewer has clear likes and dislikes.",
      "",
      "## Weekly Movie Trends",
      "",
      fenced(excerpt(trendingMovies, 16)),
      "",
      "## Weekly TV Trends",
      "",
      fenced(excerpt(trendingTv, 16)),
      "",
      "## Language Momentum",
      "",
      fenced(excerpt(languageTrends, 24)),
      "",
      "## Action-Ready Movie Picks",
      "",
      fenced(excerpt(actionReady, 24)),
      "",
      "## Family-Safe Picks",
      "",
      fenced(excerpt(familySafe, 24)),
      "",
      "## Taste Profile Probe",
      "",
      fenced(excerpt(tasteProbe, 24)),
      "",
      "## Re-run Commands",
      "",
      "Local stdio MCP:",
      "",
      "```bash",
      "npm run build",
      `set -a && source ./.env && set +a && node scripts/weekly-streaming-radar.mjs --country ${country}`,
      "```",
      "",
      "Cloudflare-hosted MCP:",
      "",
      "```bash",
      `TMDB_MCP_ACCESS_TOKEN=<your-access-token> node scripts/weekly-streaming-radar.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --country ${country}`,
      "```",
      "",
    ].join("\n");

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, artifact);
    console.log(`Wrote ${outputPath}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
