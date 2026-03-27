#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(pluginRoot, "..", "..");
const launcherPath = path.join(scriptDir, "run-server.sh");
const envExamplePath = path.join(repoRoot, ".env.example");
const envPath = path.join(repoRoot, ".env");
const repoPluginManifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
const repoPluginReadmePath = path.join(pluginRoot, "README.md");
const repoPluginIconPath = path.join(pluginRoot, "assets", "tmdb.svg");

const codexConfigPath = path.join(os.homedir(), ".codex", "config.toml");
const claudeConfigPath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Claude",
  "claude_desktop_config.json",
);

const codexCuratedRoot = path.join(os.homedir(), ".codex", ".tmp", "plugins");
const codexCuratedMarketplacePath = path.join(codexCuratedRoot, ".agents", "plugins", "marketplace.json");
const codexCuratedPluginRoot = path.join(codexCuratedRoot, "plugins", "tmdb");
const codexCachePluginBase = path.join(os.homedir(), ".codex", "plugins", "cache", "openai-curated", "tmdb");

const codexMarkerStart = "# BEGIN mcp-server-tmdb";
const codexMarkerEnd = "# END mcp-server-tmdb";
const codexBlock = [
  codexMarkerStart,
  "[mcp_servers.tmdb_local]",
  `command = ${JSON.stringify(launcherPath)}`,
  codexMarkerEnd,
  "",
].join("\n");

const codexPluginMarkerStart = "# BEGIN tmdb-openai-curated-plugin";
const codexPluginMarkerEnd = "# END tmdb-openai-curated-plugin";
const codexPluginBlock = [
  codexPluginMarkerStart,
  '[plugins."tmdb@openai-curated"]',
  "enabled = true",
  codexPluginMarkerEnd,
  "",
].join("\n");

function ensureFile(pathname, initialContent) {
  fs.mkdirSync(path.dirname(pathname), { recursive: true });
  if (!fs.existsSync(pathname)) {
    fs.writeFileSync(pathname, initialContent, "utf8");
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readJson(pathname, fallback) {
  if (!fs.existsSync(pathname)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(pathname, "utf8"));
}

function writeJson(pathname, value) {
  fs.mkdirSync(path.dirname(pathname), { recursive: true });
  fs.writeFileSync(pathname, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function updateCodexConfig() {
  ensureFile(codexConfigPath, "");
  const current = fs.readFileSync(codexConfigPath, "utf8");

  const blockRegex = new RegExp(
    `${escapeRegex(codexMarkerStart)}[\\s\\S]*?${escapeRegex(codexMarkerEnd)}\\n?`,
    "g",
  );
  const pluginBlockRegex = new RegExp(
    `${escapeRegex(codexPluginMarkerStart)}[\\s\\S]*?${escapeRegex(codexPluginMarkerEnd)}\\n?`,
    "g",
  );

  let next = current.replace(blockRegex, "").replace(pluginBlockRegex, "").trimEnd();
  if (next.length > 0) {
    next += "\n\n";
  }
  next += codexBlock;
  next += "\n";
  next += codexPluginBlock;

  fs.writeFileSync(codexConfigPath, next, "utf8");
}

function updateClaudeConfig() {
  ensureFile(claudeConfigPath, "{\n  \"mcpServers\": {}\n}\n");
  const current = JSON.parse(fs.readFileSync(claudeConfigPath, "utf8"));
  const next = typeof current === "object" && current !== null ? current : {};
  next.mcpServers = typeof next.mcpServers === "object" && next.mcpServers !== null ? next.mcpServers : {};
  next.mcpServers["tmdb-local"] = {
    command: launcherPath,
    args: [],
  };
  fs.writeFileSync(claudeConfigPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function ensureEnvFile() {
  if (fs.existsSync(envPath)) {
    return;
  }
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
  }
}

function buildInstalledPluginPayload() {
  const manifest = JSON.parse(fs.readFileSync(repoPluginManifestPath, "utf8"));
  const pluginManifest = {
    ...manifest,
    mcpServers: "./.mcp.json",
    interface: {
      ...manifest.interface,
      composerIcon: "./assets/tmdb.svg",
      logo: "./assets/tmdb.svg",
      screenshots: [],
    },
  };

  const pluginMcpConfig = {
    mcpServers: {
      tmdb: {
        command: launcherPath,
        args: [],
        note: "Local TMDB MCP server launched from the source repo.",
      },
    },
  };

  return { pluginManifest, pluginMcpConfig };
}

function installCodexUiPlugin() {
  fs.mkdirSync(path.join(codexCuratedPluginRoot, ".codex-plugin"), { recursive: true });
  fs.mkdirSync(path.join(codexCuratedPluginRoot, "assets"), { recursive: true });

  const { pluginManifest, pluginMcpConfig } = buildInstalledPluginPayload();

  writeJson(path.join(codexCuratedPluginRoot, ".codex-plugin", "plugin.json"), pluginManifest);
  writeJson(path.join(codexCuratedPluginRoot, ".mcp.json"), pluginMcpConfig);
  fs.copyFileSync(repoPluginIconPath, path.join(codexCuratedPluginRoot, "assets", "tmdb.svg"));
  fs.copyFileSync(repoPluginReadmePath, path.join(codexCuratedPluginRoot, "README.md"));

  const marketplace = readJson(codexCuratedMarketplacePath, {
    name: "openai-curated",
    interface: {
      displayName: "Codex official",
    },
    plugins: [],
  });

  const entry = {
    name: "tmdb",
    source: {
      source: "local",
      path: "./plugins/tmdb",
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    },
    category: "Entertainment",
  };

  const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const existingIndex = plugins.findIndex((plugin) => plugin && plugin.name === "tmdb");
  if (existingIndex === -1) {
    plugins.push(entry);
  } else {
    plugins[existingIndex] = entry;
  }
  marketplace.plugins = plugins;

  if (!marketplace.name) {
    marketplace.name = "openai-curated";
  }
  if (typeof marketplace.interface !== "object" || marketplace.interface === null) {
    marketplace.interface = { displayName: "Codex official" };
  } else if (!marketplace.interface.displayName) {
    marketplace.interface.displayName = "Codex official";
  }

  writeJson(codexCuratedMarketplacePath, marketplace);
}

function installCodexCachedPlugin() {
  const { pluginManifest, pluginMcpConfig } = buildInstalledPluginPayload();
  const revision = crypto
    .createHash("sha1")
    .update(JSON.stringify(pluginManifest))
    .update(JSON.stringify(pluginMcpConfig))
    .digest("hex");
  const revisionRoot = path.join(codexCachePluginBase, revision);

  fs.rmSync(codexCachePluginBase, { recursive: true, force: true });
  fs.mkdirSync(path.join(revisionRoot, ".codex-plugin"), { recursive: true });
  fs.mkdirSync(path.join(revisionRoot, "assets"), { recursive: true });

  writeJson(path.join(revisionRoot, ".codex-plugin", "plugin.json"), pluginManifest);
  writeJson(path.join(revisionRoot, ".mcp.json"), pluginMcpConfig);
  fs.copyFileSync(repoPluginIconPath, path.join(revisionRoot, "assets", "tmdb.svg"));
}

function main() {
  if (!fs.existsSync(launcherPath)) {
    throw new Error(`Launcher script not found: ${launcherPath}`);
  }

  ensureEnvFile();
  installCodexUiPlugin();
  installCodexCachedPlugin();
  updateCodexConfig();
  updateClaudeConfig();

  console.log("Installed local TMDB Codex plugin and MCP integrations.");
  console.log(`Codex config: ${codexConfigPath}`);
  console.log(`Codex plugin marketplace: ${codexCuratedMarketplacePath}`);
  console.log(`Codex plugin root: ${codexCuratedPluginRoot}`);
  console.log(`Claude Desktop config: ${claudeConfigPath}`);
  console.log(`Launcher: ${launcherPath}`);
  console.log("");
  console.log("Next steps:");
  console.log(`1. Put your real TMDB_API_KEY in ${envPath} or export it in your shell.`);
  console.log("2. Run `npm install` if dist/index.js is missing.");
  console.log("3. Restart Codex and Claude Desktop if they were already open.");
}

main();
