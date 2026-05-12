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
const defaultOutputPath = path.join(repoRoot, "examples", "release-calendar-watchlist.md");

const args = process.argv.slice(2);
const mcpUrl = valueAfter("--mcp-url");
const outputPath = path.resolve(valueAfter("--out") || defaultOutputPath);
const country = (valueAfter("--country") || "US").toUpperCase();
const language = valueAfter("--language") || "any";
const genre = valueAfter("--genre");
const days = Math.min(180, Math.max(7, Number(valueAfter("--days") || "90")));
const accessToken = valueAfter("--access-token") || process.env.TMDB_MCP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function usage() {
  console.log(`Usage:
  npm run build
  node scripts/release-calendar-watchlist.mjs --country US --days 90
  node scripts/release-calendar-watchlist.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --country IN --language hi

Options:
  --mcp-url <url>       Remote Cloudflare MCP endpoint. Omit for local stdio.
  --access-token <tok>  Bearer token for protected remote endpoints.
  --country <code>      Country/region for release and watch-provider context. Defaults to US.
  --language <code>     Original language code, or any. Defaults to any.
  --genre <name>        Optional genre name, for example action, comedy, or family.
  --days <number>       Forward-looking window, 7 to 180 days. Defaults to 90.
  --out <path>          Markdown artifact path. Defaults to examples/release-calendar-watchlist.md.

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
      name: "tmdb-release-calendar-watchlist",
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
      name: "tmdb-release-calendar-watchlist",
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

function parseMovies(text, limit = 12) {
  const matches = [...text.matchAll(/^(.+?) \(([^)]*)\) - ID: (\d+)\nRating: ([\d.]+)\/10\nOverview: ([\s\S]*?)(?=\n---\n|$)/gm)];
  return matches.slice(0, limit).map((match) => ({
    title: match[1].trim(),
    year: match[2].trim(),
    id: match[3],
    rating: Number(match[4]),
    overview: match[5].trim(),
  }));
}

function excerpt(text, maxLines = 18) {
  return text.split("\n").slice(0, maxLines).join("\n");
}

function fenced(text) {
  return `\`\`\`text\n${text.replaceAll("```", "'''")}\n\`\`\``;
}

function isoDate(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function scoreWatchLater(movie) {
  let score = movie.rating * 10;
  if (movie.rating >= 7.2) score += 15;
  if (Number(movie.year) >= new Date().getUTCFullYear()) score += 5;
  return Math.round(score);
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const client = mcpUrl ? await createRemoteClient(mcpUrl) : await createLocalClient();
  try {
    const windowStart = isoDate(0);
    const windowEnd = isoDate(days);
    const filters = {
      sortBy: "release_date.desc",
      minRating: "0",
      ...(genre ? { genre } : {}),
      ...(language !== "any" ? { language } : {}),
    };

    const [upcomingText, familyText, providerProbeText] = await Promise.all([
      callToolText(client, "advanced_search", filters),
      callToolText(client, "get_weekend_watchlist", {
        mood: "family",
        country,
        language,
        runtime: "130",
        minRating: "6.5",
        services: ["Netflix", "Prime Video"],
        familySafe: "true",
      }),
      callToolText(client, "find_where_to_watch", {
        titles: ["The Matrix", "Inception"],
        country,
        services: ["Netflix", "Prime Video"],
      }),
    ]);

    const upcoming = parseMovies(upcomingText, 10);
    const watchLater = upcoming
      .map((movie) => ({
        ...movie,
        watchLaterScore: scoreWatchLater(movie),
      }))
      .sort((a, b) => b.watchLaterScore - a.watchLaterScore)
      .slice(0, 6);

    const generatedAt = new Date().toISOString();
    const artifact = [
      "# Release Calendar Watchlist",
      "",
      `Generated: ${generatedAt}`,
      `Mode: ${client.mode}`,
      `Country: ${country}`,
      `Language: ${language}`,
      genre ? `Genre: ${genre}` : "Genre: any",
      `Window: ${windowStart} to ${windowEnd}`,
      `Endpoint: ${mcpUrl || "local stdio dist/index.js"}`,
      "",
      "## Watch-Later Candidates",
      "",
      watchLater.length > 0
        ? watchLater.map((movie, index) =>
            `${index + 1}. ${movie.title} (${movie.year}) - ID: ${movie.id}\n` +
            `Rating: ${movie.rating}/10 | Watch-later score: ${movie.watchLaterScore}\n` +
            `Track this if: the title fits your release-window theme and provider status appears later.\n` +
            `Overview: ${movie.overview}`,
          ).join("\n---\n")
        : "No candidates parsed from the current release scan.",
      "",
      "## Release Scan",
      "",
      fenced(excerpt(upcomingText, 30)),
      "",
      "## Family-Safe Baseline",
      "",
      fenced(excerpt(familyText, 24)),
      "",
      "## Provider Probe",
      "",
      fenced(excerpt(providerProbeText, 24)),
      "",
      "## Notes",
      "",
      "- This is a script-first artifact, not a new MCP tool.",
      "- TMDB provider data is usually strongest after a movie is released; treat unreleased provider gaps as expected.",
      "- Re-run near the release date to refresh provider and rating signals.",
      "",
      "## Re-run Commands",
      "",
      "Local stdio MCP:",
      "",
      "```bash",
      "npm run build",
      `set -a && source ./.env && set +a && node scripts/release-calendar-watchlist.mjs --country ${country} --language ${language} --days ${days}${genre ? ` --genre ${genre}` : ""}`,
      "```",
      "",
      "Cloudflare-hosted MCP:",
      "",
      "```bash",
      `TMDB_MCP_ACCESS_TOKEN=<your-access-token> node scripts/release-calendar-watchlist.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --country ${country} --language ${language} --days ${days}${genre ? ` --genre ${genre}` : ""}`,
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
