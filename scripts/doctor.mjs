#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { localEnvironment } from "./local-environment.mjs";

const args = process.argv.slice(2);
const root = path.resolve(args.includes("--repo") ? args[args.indexOf("--repo") + 1] || "." : path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const json = args.includes("--json");
if (args.includes("--help")) {
  console.log("Usage: npm run doctor -- [--online] [--docker] [--json] [--repo PATH]\nRead-only checks. --online makes one TMDB API request. --docker checks the Docker engine. No credentials are printed or client files changed.");
  process.exit(0);
}
const checks = [];
const add = (id, status, message) => checks.push({ id, status, message });
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
const modernNode = nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 12);
add("node", modernNode ? "pass" : "fail", modernNode ? `Node ${process.versions.node}; executable: ${process.execPath}` : "Node.js 22.12+ required for the source checkout. Upgrade Node, then rerun this command.");
let runtime = { env: { ...process.env }, sources: {} };
try { if (modernNode) runtime = localEnvironment(root); }
catch (error) { add("env-files", "fail", error.message); }
const key = runtime.env.TMDB_API_KEY?.trim();
const hasKey = Boolean(key && !/^(your[_ -]?tmdb|your_api|fixture-key$|dummy$|choose_a_)/i.test(key));
add("credentials", hasKey ? "pass" : "fail", hasKey ? `TMDB_API_KEY is configured via ${runtime.sources.TMDB_API_KEY || "environment"}; value hidden.` : "TMDB_API_KEY is missing or a placeholder. Set it in .env or your MCP client's environment.");
let dependencies = false;
try { createRequire(path.join(root, "package.json")).resolve("@modelcontextprotocol/sdk/client/index.js"); createRequire(path.join(root, "package.json")).resolve("zod"); dependencies = true; }
catch { /* Only report the repair command, never raw dependency error content. */ }
add("dependencies", dependencies ? "pass" : "fail", dependencies ? "MCP SDK and schema dependencies resolve." : "Dependencies are missing. Run npm ci (or npm install on a new clone).");
const entry = path.join(root, "dist/index.js");
function staleBuild() {
  const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => item.isDirectory() ? walk(path.join(dir, item.name)) : item.name.endsWith(".ts") ? [path.join(dir, item.name)] : []) : [];
  return walk(path.join(root, "src")).some((file) => {
    const output = path.join(root, "dist", path.relative(path.join(root, "src"), file).replace(/\.ts$/, ".js"));
    return !fs.existsSync(output) || fs.statSync(file).mtimeMs > fs.statSync(output).mtimeMs;
  });
}
const built = fs.existsSync(entry);
let stale = true;
try { stale = staleBuild(); } catch { /* An unreadable source/output tree is not ready. */ }
add("build", !built || stale ? "fail" : "pass", !built ? "Build output is missing. Run npm run build." : stale ? "Build output is older than source. Run npm run build and restart your MCP client." : "Build output exists and is current.");
const launcher = path.join(root, "plugins/tmdb/scripts/run-server.sh");
const portableLauncher = path.join(root, "plugins/tmdb/scripts/run-server.mjs");
add("launcher", fs.existsSync(portableLauncher) ? "pass" : "fail", fs.existsSync(portableLauncher) ? "Portable Node launcher exists; existing shell-launcher configurations remain supported." : "Portable launcher is missing. Update this checkout or use dist/index.js with an explicit API-key environment.");
const claudePath = process.platform === "darwin" ? path.join(os.homedir(), "Library/Application Support/Claude/claude_desktop_config.json") : process.platform === "win32" ? path.join(process.env.APPDATA || os.homedir(), "Claude/claude_desktop_config.json") : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "Claude/claude_desktop_config.json");
if (fs.existsSync(claudePath)) {
  try {
    const config = JSON.parse(fs.readFileSync(claudePath, "utf8"));
    const registered = Object.values(config.mcpServers || {}).some((server) => JSON.stringify(server).includes(launcher) || JSON.stringify(server).includes(portableLauncher) || JSON.stringify(server).includes(entry));
    add("claude", registered ? "pass" : "warn", registered ? "Claude Desktop references this checkout." : "Claude Desktop JSON is readable; this checkout was not found. Manual or remote MCP configuration may be intentional.");
  } catch { add("claude", "warn", "Claude Desktop configuration could not be parsed. Check its JSON syntax; no file was changed."); }
} else add("claude", "skip", "No Claude Desktop config found. Configure a client manually or use the repo installer on macOS.");
const codexPath = path.join(os.homedir(), ".codex/config.toml");
if (fs.existsSync(codexPath)) {
  try {
    const contents = fs.readFileSync(codexPath, "utf8");
    const registered = [launcher, portableLauncher, entry].some((value) => contents.includes(value));
    add("codex", registered ? "pass" : "warn", registered ? "Codex config references this checkout (reference check only)." : "This checkout was not found in Codex config; manual or remote MCP configuration may be intentional.");
  } catch { add("codex", "warn", "Codex config could not be read; check its file permissions. No file was changed."); }
} else add("codex", "skip", "No Codex config found. A remote MCP client can also use this server.");
if (modernNode && dependencies && built) {
  let client, timer;
  try {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { TMDB_API_KEY: "doctor-offline-probe" }, stderr: "pipe" });
    client = new Client({ name: "tmdb-install-doctor", version: "1.0.0" });
    const probe = async () => { await client.connect(transport); transport.stderr?.resume(); return client.listTools(); };
    const result = await Promise.race([probe(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 10000); })]);
    const required = ["search_movies", "get_weekend_watchlist", "check_watchlist_availability", "plan_streaming_coverage"];
    const missing = required.filter((name) => !result.tools.some((tool) => tool.name === name));
    add("mcp", missing.length ? "fail" : "pass", missing.length ? "MCP starts but required tools are missing. Rebuild and restart the client." : `MCP handshake and tool discovery passed (${result.tools.length} tools). No TMDB request was made.`);
  } catch { add("mcp", "fail", "MCP startup/tool discovery failed or timed out. Rebuild, check the Node executable, and rerun the doctor."); }
  finally { clearTimeout(timer); if (client) await client.close().catch(() => {}); }
} else add("mcp", "skip", "Fix Node, dependencies, and build checks before checking MCP startup.");
if (args.includes("--online") && hasKey) {
  try {
    const url = new URL(`${runtime.env.TMDB_BASE_URL || "https://api.themoviedb.org/3"}/genre/movie/list`);url.searchParams.set("api_key", key);
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (response.ok) {
      const payload = await response.json().catch(() => null);
      const valid = Array.isArray(payload?.genres);
      add("api", valid ? "pass" : "fail", valid ? "TMDB API accepted the key and returned a valid genre response." : "The endpoint returned an unexpected response. Check TMDB_BASE_URL and proxy configuration.");
    } else add("api", "fail", [401,403].includes(response.status) ? "TMDB rejected the credential. Check the API key and account access." : `TMDB returned HTTP ${response.status}. Check provider availability or rate limits.`);
  } catch { add("api", "fail", "TMDB could not be reached. Check network/DNS/proxy settings; this does not establish that the key is invalid."); }
} else add("api", "skip", args.includes("--online") ? "Configure a key before online validation." : "Online API validation not requested. Use --online to check key acceptance and connectivity.");
if (args.includes("--docker")) {
  try { const version = execFileSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "pipe"] }).trim(); add("docker", "pass", `Docker engine responds (${version}).`); }
  catch { add("docker", "fail", "Docker is unavailable or its engine is stopped. Install/start Docker, then rerun with --docker."); }
}
const report = { ok: !checks.some((check) => check.status === "fail"), checks, reminder: "Restart your MCP client after rebuilding or changing its configuration. The doctor does not edit client files." };
if (json) console.log(JSON.stringify(report, null, 2));
else { for (const check of checks) console.log(`${check.status.toUpperCase().padEnd(4)} ${check.id}: ${check.message}`); console.log(report.reminder); }
process.exitCode = report.ok ? 0 : 1;
