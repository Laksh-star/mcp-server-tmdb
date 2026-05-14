#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const serverEntry = path.join(repoRoot, "dist", "index.js");
const defaultOutputPath = path.join(repoRoot, "examples", "provider-change-monitor.md");
const defaultSnapshotPath = path.join(repoRoot, "examples", "provider-change-snapshot.json");
const defaultTitles = ["The Matrix", "Inception", "The Dark Knight"];

const args = process.argv.slice(2);
const mcpUrl = valueAfter("--mcp-url");
const outputPath = path.resolve(valueAfter("--out") || defaultOutputPath);
const snapshotPath = path.resolve(valueAfter("--snapshot") || defaultSnapshotPath);
const country = (valueAfter("--country") || "US").toUpperCase();
const titles = csvArg("--titles", defaultTitles);
const services = csvArg("--services", []);
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
  node scripts/provider-change-monitor.mjs --country US --titles "The Matrix,Inception" --services "Netflix,Prime Video"
  node scripts/provider-change-monitor.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --country IN --titles "Dune,RRR"

Options:
  --mcp-url <url>       Remote Cloudflare MCP endpoint. Omit for local stdio.
  --access-token <tok>  Bearer token for protected remote endpoints.
  --country <code>      Watch-provider country, defaults to US.
  --titles <csv>        Comma-separated titles to monitor. Defaults to a small sample list.
  --services <csv>      Optional preferred providers to highlight.
  --snapshot <path>     JSON state path. Defaults to examples/provider-change-snapshot.json.
  --out <path>          Markdown artifact path. Defaults to examples/provider-change-monitor.md.

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
      name: "tmdb-provider-change-monitor",
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
      name: "tmdb-provider-change-monitor",
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

function parseListLine(block, label) {
  const match = block.match(new RegExp(`^${label}: (.+)$`, "m"));
  if (!match) return [];
  return match[1].split(",").map((item) => item.trim()).filter(Boolean);
}

function parseProviderItems(text) {
  const blocks = text.split(/\n(?=\d+\. )/g).filter((block) => /^\d+\. /m.test(block));
  return blocks.map((block) => {
    const lines = block.split("\n");
    const query = lines[0]?.replace(/^\d+\. /, "").trim() || "Unknown";
    const matched = block.match(/^Matched: (.+) \(([^)]*)\) - ID: (\d+)$/m);
    const preferred = block.match(/^Preferred service match: (.+)$/m);
    const link = block.match(/^TMDB watch link: (.+)$/m);
    return {
      query,
      matchedTitle: matched?.[1]?.trim(),
      year: matched?.[2]?.trim(),
      id: matched?.[3],
      streaming: parseListLine(block, "Streaming"),
      rent: parseListLine(block, "Rent"),
      buy: parseListLine(block, "Buy"),
      link: link?.[1]?.trim(),
      preferredMatch: preferred?.[1]?.trim(),
      hasProviderData: Boolean(matched) && !block.includes("No watch providers found"),
      raw: block.trim(),
    };
  });
}

function normalizeProvider(provider) {
  return provider.toLowerCase().replace(/\s+/g, " ").trim();
}

function diffProviders(previous = [], current = []) {
  const previousMap = new Map(previous.map((provider) => [normalizeProvider(provider), provider]));
  const currentMap = new Map(current.map((provider) => [normalizeProvider(provider), provider]));
  return {
    added: [...currentMap.entries()]
      .filter(([key]) => !previousMap.has(key))
      .map(([, provider]) => provider),
    removed: [...previousMap.entries()]
      .filter(([key]) => !currentMap.has(key))
      .map(([, provider]) => provider),
  };
}

function compareSnapshots(previousSnapshot, currentSnapshot) {
  return Object.entries(currentSnapshot.items).map(([query, current]) => {
    const previous = previousSnapshot?.items?.[query];
    const categories = ["streaming", "rent", "buy"].map((category) => ({
      category,
      ...diffProviders(previous?.[category], current[category]),
    }));
    const hasChanges = !previous || categories.some((item) => item.added.length > 0 || item.removed.length > 0);
    return {
      query,
      current,
      previous,
      categories,
      hasChanges,
      status: !previous ? "new-baseline" : hasChanges ? "changed" : "unchanged",
    };
  });
}

async function readSnapshot(filePath) {
  if (!existsSync(filePath)) return undefined;
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text);
}

function bulletList(items) {
  return items.length ? items.map((item) => `  - ${item}`).join("\n") : "  - none";
}

function renderProviderSummary(item) {
  const lines = [
    item.streaming.length ? `Streaming: ${item.streaming.join(", ")}` : "Streaming: none found",
    item.rent.length ? `Rent: ${item.rent.join(", ")}` : "Rent: none found",
    item.buy.length ? `Buy: ${item.buy.join(", ")}` : "Buy: none found",
  ];
  if (item.preferredMatch && item.preferredMatch !== "none found") {
    lines.push(`Preferred match: ${item.preferredMatch}`);
  }
  if (item.link) lines.push(`TMDB watch link: ${item.link}`);
  return lines.join("\n");
}

function renderReport({ generatedAt, mode, previousSnapshot, currentSnapshot, comparisons, rawText }) {
  const changed = comparisons.filter((item) => item.status === "changed");
  const newBaseline = comparisons.filter((item) => item.status === "new-baseline");
  const unchanged = comparisons.filter((item) => item.status === "unchanged");
  const noProviderData = comparisons.filter((item) => !item.current.hasProviderData);

  const lines = [
    "# Provider Change Monitor",
    "",
    `Generated: ${generatedAt}`,
    `Mode: ${mode}`,
    `Country: ${currentSnapshot.country}`,
    `Titles: ${currentSnapshot.titles.join(", ")}`,
    currentSnapshot.services.length ? `Preferred services: ${currentSnapshot.services.join(", ")}` : "Preferred services: any",
    `Snapshot: ${path.relative(repoRoot, snapshotPath)}`,
    previousSnapshot?.generatedAt ? `Previous snapshot: ${previousSnapshot.generatedAt}` : "Previous snapshot: none; baseline created",
    "",
    "## Summary",
    "",
    `- Changed titles: ${changed.length}`,
    `- New baseline titles: ${newBaseline.length}`,
    `- Unchanged titles: ${unchanged.length}`,
    `- Titles with no provider data: ${noProviderData.length}`,
    "",
  ];

  if (changed.length > 0) {
    lines.push("## Provider Changes", "");
    changed.forEach((item) => {
      lines.push(`### ${item.current.matchedTitle || item.query}`);
      lines.push("");
      item.categories.forEach((category) => {
        if (category.added.length === 0 && category.removed.length === 0) return;
        lines.push(`**${category.category}**`);
        lines.push("Added:");
        lines.push(bulletList(category.added));
        lines.push("Removed:");
        lines.push(bulletList(category.removed));
        lines.push("");
      });
    });
  }

  if (newBaseline.length > 0) {
    lines.push("## Current Baseline", "");
    newBaseline.forEach((item) => {
      const heading = item.current.matchedTitle
        ? `${item.current.matchedTitle} (${item.current.year})`
        : item.query;
      lines.push(`### ${heading}`, "");
      lines.push(renderProviderSummary(item.current), "");
    });
  }

  if (unchanged.length > 0) {
    lines.push("## Unchanged", "");
    unchanged.forEach((item) => {
      const label = item.current.matchedTitle || item.query;
      lines.push(`- ${label}`);
    });
    lines.push("");
  }

  if (noProviderData.length > 0) {
    lines.push("## No Provider Data", "");
    noProviderData.forEach((item) => {
      lines.push(`- ${item.current.matchedTitle || item.query}`);
    });
    lines.push("");
  }

  lines.push(
    "## Notes",
    "",
    "- This is a script-first artifact, not a new MCP tool.",
    "- Re-run with the same snapshot path to detect additions and removals.",
    "- TMDB provider availability can vary by country and can change without notice.",
    "",
    "## Re-run Commands",
    "",
    "Local stdio MCP:",
    "",
    "```bash",
    "npm run build",
    `set -a && source ./.env && set +a && node scripts/provider-change-monitor.mjs --country ${currentSnapshot.country} --titles "${currentSnapshot.titles.join(",")}"${currentSnapshot.services.length ? ` --services "${currentSnapshot.services.join(",")}"` : ""}`,
    "```",
    "",
    "Cloudflare-hosted MCP:",
    "",
    "```bash",
    `TMDB_MCP_ACCESS_TOKEN=<your-access-token> node scripts/provider-change-monitor.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --country ${currentSnapshot.country} --titles "${currentSnapshot.titles.join(",")}"${currentSnapshot.services.length ? ` --services "${currentSnapshot.services.join(",")}"` : ""}`,
    "```",
    "",
    "## Raw Provider Probe",
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

  if (titles.length === 0 || titles.length > 5) {
    throw new Error("Provider monitor requires 1 to 5 titles because find_where_to_watch accepts 1 to 5 titles.");
  }

  const client = mcpUrl ? await createRemoteClient(mcpUrl) : await createLocalClient();
  try {
    const rawText = await callToolText(client, "find_where_to_watch", {
      titles,
      country,
      services,
    });
    const generatedAt = new Date().toISOString();
    const parsedItems = parseProviderItems(rawText);
    const currentSnapshot = {
      generatedAt,
      country,
      titles,
      services,
      items: Object.fromEntries(parsedItems.map((item) => [item.query, item])),
    };
    const previousSnapshot = await readSnapshot(snapshotPath);
    const comparisons = compareSnapshots(previousSnapshot, currentSnapshot);
    const report = renderReport({
      generatedAt,
      mode: client.mode,
      previousSnapshot,
      currentSnapshot,
      comparisons,
      rawText,
    });

    await mkdir(path.dirname(outputPath), { recursive: true });
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(outputPath, report);
    await writeFile(snapshotPath, `${JSON.stringify(currentSnapshot, null, 2)}\n`);
    console.log(`Wrote ${outputPath}`);
    console.log(`Updated ${snapshotPath}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
