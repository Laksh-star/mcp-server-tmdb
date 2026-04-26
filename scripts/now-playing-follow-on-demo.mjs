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
const defaultOutputPath = path.join(repoRoot, "examples", "now-playing-follow-on-demo.md");

const args = process.argv.slice(2);
const mcpUrl = valueAfter("--mcp-url");
const region = valueAfter("--region") || "US";
const page = Number(valueAfter("--page") || "1");
const outputPath = path.resolve(valueAfter("--out") || defaultOutputPath);
const accessToken = valueAfter("--access-token") || process.env.TMDB_MCP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage() {
  console.log(`Usage:
  npm run build
  node scripts/now-playing-follow-on-demo.mjs --region US
  node scripts/now-playing-follow-on-demo.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --region US

Options:
  --mcp-url <url>       Remote Cloudflare MCP endpoint. Omit for local stdio.
  --access-token <tok>  Bearer token for protected remote endpoints.
  --region <code>      TMDB watch-provider/theater region. Defaults to US.
  --page <number>      TMDB now-playing page. Defaults to 1.
  --out <path>         Markdown artifact path. Defaults to examples/now-playing-follow-on-demo.md.

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
      name: "tmdb-now-playing-follow-on-demo",
      version: "1.0.0",
    },
  });

  return {
    mode: "remote",
    serverName: initializeResult.serverInfo?.name || "unknown",
    async listTools() {
      return rpc("tools/list", {});
    },
    async callTool(name, toolArgs) {
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
      name: "tmdb-now-playing-follow-on-demo",
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

function parseMovies(text, limit = 10) {
  const matches = [...text.matchAll(/^(.+?) \(([^)]*)\) - ID: (\d+)\nRating: ([\d.]+)\/10\nOverview: ([\s\S]*?)(?=\n---\n|$)/gm)];
  return matches.slice(0, limit).map((match) => ({
    title: match[1].trim(),
    year: match[2].trim(),
    id: match[3],
    rating: Number(match[4]),
    overview: match[5].trim(),
  }));
}

function hasProvider(text) {
  return /Streaming \(subscription\):|Available to rent:|Available to buy:/i.test(text);
}

function excerpt(text, maxLines = 16) {
  return text.split("\n").slice(0, maxLines).join("\n");
}

function markdownFence(text) {
  return `\`\`\`text\n${text.replaceAll("```", "'''")}\n\`\`\``;
}

async function callToolText(client, name, toolArgs, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return textContent(await client.callTool(name, toolArgs));
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const message = error instanceof Error ? error.message : String(error);
      if (!/ECONNRESET|ETIMEDOUT|fetch failed|network|TMDB API request failed/i.test(message)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const client = mcpUrl ? await createRemoteClient(mcpUrl) : await createLocalClient();
  try {
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((tool) => tool.name).sort();
    const required = ["get_now_playing", "get_movie_details", "get_watch_providers", "get_recommendations", "get_similar_movies"];
    const missing = required.filter((tool) => !toolNames.includes(tool));
    if (missing.length > 0) {
      throw new Error(`MCP server is missing required tools: ${missing.join(", ")}`);
    }

    const nowPlayingText = await callToolText(client, "get_now_playing", { region, page });
    const nowPlaying = parseMovies(nowPlayingText, 8);
    if (nowPlaying.length === 0) {
      throw new Error("Could not parse any now-playing movies from the MCP response.");
    }

    const primary = nowPlaying.find((movie) => movie.rating >= 6) || nowPlaying[0];
    const [detailsText, primaryProvidersText, recommendationsText] = await Promise.all([
      callToolText(client, "get_movie_details", { movieId: primary.id }),
      callToolText(client, "get_watch_providers", { movieId: primary.id, country: region }),
      callToolText(client, "get_recommendations", { movieId: primary.id }),
    ]);

    let followOnSource = "get_recommendations";
    let recommendations = parseMovies(recommendationsText, 3);
    if (recommendations.length === 0) {
      followOnSource = "get_similar_movies";
      const similarText = await callToolText(client, "get_similar_movies", { movieId: primary.id });
      recommendations = parseMovies(similarText, 3);
    }

    const recommendationProviders = [];
    for (const movie of recommendations) {
      const providersText = await callToolText(client, "get_watch_providers", {
        movieId: movie.id,
        country: region,
      });
      recommendationProviders.push({ ...movie, providersText });
    }

    const generatedAt = new Date().toISOString();
    const artifact = [
      "# TMDB Cloudflare MCP Demo: Now Playing to Watch-Next",
      "",
      `Generated: ${generatedAt}`,
      `Mode: ${client.mode}`,
      `Server: ${client.serverName}`,
      `Endpoint: ${mcpUrl || "local stdio dist/index.js"}`,
      `Region: ${region}`,
      "",
      "## Use Case",
      "",
      "A user wants a movie they can act on tonight. The workflow starts with live theatrical discovery, chooses a current title, enriches it with details, checks watch-provider availability, then suggests follow-on movies with availability for the same region.",
      "",
      "## MCP Tool Chain",
      "",
      required.map((tool, index) => `${index + 1}. \`${tool}\``).join("\n"),
      "",
      "## Current Now-Playing Scan",
      "",
      nowPlaying.map((movie, index) => `${index + 1}. ${movie.title} (${movie.year}) - TMDB ID ${movie.id} - ${movie.rating}/10`).join("\n"),
      "",
      "## Primary Pick",
      "",
      `${primary.title} (${primary.year}) - TMDB ID ${primary.id} - ${primary.rating}/10`,
      "",
      "### Details",
      "",
      markdownFence(excerpt(detailsText, 18)),
      "",
      "### Provider Availability",
      "",
      markdownFence(primaryProvidersText),
      "",
      hasProvider(primaryProvidersText)
        ? "Decision: this pick has TMDB provider availability for the selected region."
        : "Decision: TMDB did not return direct provider availability for this pick in the selected region, so the follow-on list is useful as an alternate path.",
      "",
      "## Follow-On Suggestions",
      "",
      `Source: \`${followOnSource}\``,
      "",
      recommendationProviders.length
        ? recommendationProviders.map((movie, index) => [
          `### ${index + 1}. ${movie.title} (${movie.year}) - TMDB ID ${movie.id} - ${movie.rating}/10`,
          "",
          movie.overview,
          "",
          markdownFence(movie.providersText),
        ].join("\n")).join("\n\n")
        : "TMDB returned no recommendations or similar movies for the selected now-playing movie.",
      "",
      "## Re-run Commands",
      "",
      "Local stdio MCP:",
      "",
      "```bash",
      "npm run build",
      `set -a && source ./.env && set +a && node scripts/now-playing-follow-on-demo.mjs --region ${region}`,
      "```",
      "",
      "Cloudflare-hosted MCP:",
      "",
      "```bash",
      `TMDB_MCP_ACCESS_TOKEN=<your-access-token> node scripts/now-playing-follow-on-demo.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --region ${region}`,
      "```",
      "",
    ].join("\n");

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, artifact);

    console.log(`Wrote ${outputPath}`);
    console.log(`Primary pick: ${primary.title} (${primary.year}) - ID ${primary.id}`);
    console.log(`Follow-on suggestions checked: ${recommendationProviders.length}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
