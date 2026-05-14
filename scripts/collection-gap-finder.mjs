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
const defaultOutputPath = path.join(repoRoot, "examples", "collection-gap-finder.md");

const args = process.argv.slice(2);
const mcpUrl = valueAfter("--mcp-url");
const outputPath = path.resolve(valueAfter("--out") || defaultOutputPath);
const franchise = valueAfter("--franchise") || valueAfter("--query") || "The Matrix";
const country = (valueAfter("--country") || "US").toUpperCase();
const watched = csvArg("--watched", []);
const services = csvArg("--services", []);
const maxMovies = valueAfter("--max-movies") || "12";
const accessToken = valueAfter("--access-token") || process.env.TMDB_MCP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function csvArg(flag, fallback) {
  const value = valueAfter(flag);
  if (!value) return fallback;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function usage() {
  console.log(`Usage:
  npm run build
  node scripts/collection-gap-finder.mjs --franchise "The Matrix" --watched "The Matrix" --country US
  node scripts/collection-gap-finder.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --franchise "Mission Impossible" --watched "Mission: Impossible" --country IN

Options:
  --mcp-url <url>       Remote Cloudflare MCP endpoint. Omit for local stdio.
  --access-token <tok>  Bearer token for protected remote endpoints.
  --franchise <query>   Franchise, collection, or seed title. Defaults to The Matrix.
  --query <query>       Alias for --franchise.
  --watched <csv>       Comma-separated watched titles or TMDB IDs.
  --country <code>      Watch-provider country, defaults to US.
  --services <csv>      Optional preferred providers to highlight.
  --max-movies <number> Maximum franchise entries to inspect. Defaults to 12.
  --out <path>          Markdown artifact path. Defaults to examples/collection-gap-finder.md.

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
      name: "tmdb-collection-gap-finder",
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
      name: "tmdb-collection-gap-finder",
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

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function runtimeMinutes(runtimeText) {
  const hours = runtimeText.match(/(\d+)h/);
  const minutes = runtimeText.match(/(\d+)m/);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

function parseProviders(line) {
  const match = line.match(/^(Streaming|Rent|Buy): (.+)$/);
  if (!match) return { category: "availability", providers: [] };
  return {
    category: match[1].toLowerCase(),
    providers: match[2].split(",").map((item) => item.trim()).filter(Boolean),
  };
}

function parseReleaseOrder(text) {
  const releaseSection = text.match(/Release order:\n([\s\S]*?)\n\nSuggested order:/)?.[1] || "";
  const blocks = releaseSection.split(/\n---\n/g).filter((block) => /^\d+\. /m.test(block));
  return blocks.map((block, index) => {
    const title = block.match(/^\d+\. (.+) \(([^)]*)\) - ID: (\d+)$/m);
    const rating = block.match(/^Rating: ([\d.]+)\/10 \| Runtime: (.+)$/m);
    const providerLine = block.match(/^(Streaming|Rent|Buy|Availability): (.+)$/m);
    const note = block.match(/^Note: (.+)$/m);
    const provider = parseProviders(providerLine?.[0] || "");
    return {
      index: index + 1,
      title: title?.[1]?.trim() || `Entry ${index + 1}`,
      year: title?.[2]?.trim() || "unknown",
      id: title?.[3],
      rating: rating ? Number(rating[1]) : 0,
      runtimeText: rating?.[2]?.trim() || "runtime unknown",
      runtimeMinutes: runtimeMinutes(rating?.[2] || ""),
      providerCategory: provider.category,
      providers: provider.providers,
      note: note?.[1]?.trim() || "",
    };
  });
}

function parseSuggestedTitles(text) {
  const section = text.match(/Suggested order:\n([\s\S]*?)(?:\n\nNotes:|$)/)?.[1] || "";
  return section
    .split("\n")
    .map((line) => line.match(/^\d+\. (.+) \(([^)]*)\)$/)?.[1]?.trim())
    .filter(Boolean);
}

function watchedMatcher(watchedItems) {
  const normalized = new Set(watchedItems.map(normalize));
  const ids = new Set(watchedItems.filter((item) => /^\d+$/.test(item)));
  return (movie) => ids.has(String(movie.id)) || normalized.has(normalize(movie.title));
}

function serviceMatches(movie) {
  if (services.length === 0 || movie.providers.length === 0) return [];
  return movie.providers.filter((provider) =>
    services.some((service) => normalize(provider).includes(normalize(service)) || normalize(service).includes(normalize(provider))),
  );
}

function scoreMissing(movie, position) {
  let score = Math.max(0, 100 - position * 3);
  if (movie.rating >= 7.5) score += 20;
  if (movie.rating >= 7) score += 10;
  if (movie.providerCategory === "streaming") score += 15;
  if (serviceMatches(movie).length > 0) score += 20;
  if (movie.index === 1) score += 30;
  return score;
}

function formatRuntime(totalMinutes) {
  if (!totalMinutes) return "unknown";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function movieLine(movie, prefix = "-") {
  const providerText = movie.providers.length
    ? `${movie.providerCategory}: ${movie.providers.join(", ")}`
    : "availability: no providers found";
  const matches = serviceMatches(movie);
  const serviceText = matches.length ? ` | preferred match: ${matches.join(", ")}` : "";
  return `${prefix} ${movie.title} (${movie.year}) - ID: ${movie.id || "unknown"} | ${movie.rating.toFixed(1)}/10 | ${movie.runtimeText} | ${providerText}${serviceText}`;
}

function renderReport({ generatedAt, mode, rawText, movies, watchedMovies, missingMovies, completionPath }) {
  const watchedRuntime = watchedMovies.reduce((sum, movie) => sum + movie.runtimeMinutes, 0);
  const missingRuntime = missingMovies.reduce((sum, movie) => sum + movie.runtimeMinutes, 0);
  const availableNow = missingMovies.filter((movie) => movie.providerCategory === "streaming");
  const preferredNow = missingMovies.filter((movie) => serviceMatches(movie).length > 0);
  const completionPercent = movies.length > 0 ? Math.round((watchedMovies.length / movies.length) * 100) : 0;

  const lines = [
    "# Collection Gap Finder",
    "",
    `Generated: ${generatedAt}`,
    `Mode: ${mode}`,
    `Franchise: ${franchise}`,
    `Country: ${country}`,
    watched.length ? `Watched input: ${watched.join(", ")}` : "Watched input: none",
    services.length ? `Preferred services: ${services.join(", ")}` : "Preferred services: any",
    "",
    "## Summary",
    "",
    `- Collection entries scanned: ${movies.length}`,
    `- Watched: ${watchedMovies.length}`,
    `- Missing: ${missingMovies.length}`,
    `- Completion: ${completionPercent}%`,
    `- Watched runtime: ${formatRuntime(watchedRuntime)}`,
    `- Remaining runtime: ${formatRuntime(missingRuntime)}`,
    `- Missing entries streaming now: ${availableNow.length}`,
    `- Missing entries on preferred services: ${preferredNow.length}`,
    "",
    "## Shortest Completion Path",
    "",
  ];

  if (completionPath.length > 0) {
    completionPath.forEach((movie, index) => {
      lines.push(movieLine(movie, `${index + 1}.`));
      if (movie.note) lines.push(`   ${movie.note}`);
    });
  } else {
    lines.push("No gaps found for the watched list provided.");
  }

  lines.push("", "## Watched", "");
  if (watchedMovies.length > 0) {
    watchedMovies.forEach((movie) => lines.push(movieLine(movie)));
  } else {
    lines.push("- none matched");
  }

  lines.push("", "## Missing", "");
  if (missingMovies.length > 0) {
    missingMovies.forEach((movie) => lines.push(movieLine(movie)));
  } else {
    lines.push("- none");
  }

  lines.push("", "## Release Order", "");
  movies.forEach((movie) => {
    const status = watchedMatcher(watched)(movie) ? "watched" : "missing";
    lines.push(`${movie.index}. ${movie.title} (${movie.year}) - ${status}`);
  });

  lines.push(
    "",
    "## Notes",
    "",
    "- This is a script-first artifact, not a new MCP tool.",
    "- Matching accepts watched titles or TMDB IDs; title matching is normalized but not fuzzy.",
    "- Completion path follows the franchise suggested order, then highlights provider and preferred-service availability.",
    "",
    "## Re-run Commands",
    "",
    "Local stdio MCP:",
    "",
    "```bash",
    "npm run build",
    `set -a && source ./.env && set +a && node scripts/collection-gap-finder.mjs --franchise "${franchise}" --watched "${watched.join(",")}" --country ${country}${services.length ? ` --services "${services.join(",")}"` : ""}`,
    "```",
    "",
    "Cloudflare-hosted MCP:",
    "",
    "```bash",
    `TMDB_MCP_ACCESS_TOKEN=<your-access-token> node scripts/collection-gap-finder.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --franchise "${franchise}" --watched "${watched.join(",")}" --country ${country}${services.length ? ` --services "${services.join(",")}"` : ""}`,
    "```",
    "",
    "## Raw Franchise Guide",
    "",
    "```text",
    rawText.replaceAll("```", "'''"),
    "```",
    "",
  );

  return lines.join("\n");
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const client = mcpUrl ? await createRemoteClient(mcpUrl) : await createLocalClient();
  try {
    const rawText = await callToolText(client, "build_collection_gap_plan", {
      query: franchise,
      watchedTitles: watched,
      country,
      services,
      maxMovies,
    });
    const generatedAt = new Date().toISOString();
    const report = [
      "# Collection Gap Finder",
      "",
      `Generated: ${generatedAt}`,
      `Mode: ${client.mode}`,
      `Franchise: ${franchise}`,
      `Country: ${country}`,
      watched.length ? `Watched input: ${watched.join(", ")}` : "Watched input: none",
      services.length ? `Preferred services: ${services.join(", ")}` : "Preferred services: any",
      "",
      "## Collection Gap Plan",
      "",
      "```text",
      rawText.replaceAll("```", "'''"),
      "```",
      "",
      "## Notes",
      "",
      "- This artifact is generated by the promoted MCP tool `build_collection_gap_plan`.",
      "- The script remains useful for repeatable local Markdown reports.",
      "",
    ].join("\n");

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, report);
    console.log(`Wrote ${outputPath}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
