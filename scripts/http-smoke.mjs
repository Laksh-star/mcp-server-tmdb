/** Start isolated local services, test the real Worker, then clean up on any exit. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createPlanningFixture } from "./fixtures/planning-tmdb.mjs";

const withDocker = process.argv.includes("--docker");
const fixture = createPlanningFixture();
fixture.listen(8791, withDocker ? "0.0.0.0" : "127.0.0.1");
await once(fixture, "listening");
let workerLogs = "";
const worker = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "dev", "--local", "--config", "scripts/fixtures/wrangler.jsonc", "--port", "8789"], {
  stdio: ["ignore", "pipe", "pipe"],
  detached: process.platform !== "win32",
  env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
});
for (const stream of [worker.stdout, worker.stderr]) stream.on("data", (chunk) => { workerLogs = (workerLogs + chunk).slice(-16000); });
let workerError;
worker.on("error", (error) => { workerError = error; });
async function run(script, args = []) {
  const child = spawn(process.execPath, [script, ...args], { stdio: "inherit", env: { ...process.env, TMDB_MCP_ACCESS_TOKEN: "fixture-token" } });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) throw new Error(`${script} failed (${signal || code})`);
}
try {
  const deadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < deadline) {
    if (workerError) throw workerError;
    if (worker.exitCode !== null) throw new Error(`Worker exited (${worker.exitCode})`);
    try { ready = (await fetch("http://127.0.0.1:8789/health", { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await delay(250);
  }
  if (!ready) throw new Error("Worker did not become ready within 60 seconds");
  await run("scripts/planning-http-test.mjs");
  if (withDocker) await run("scripts/docker-smoke.mjs", ["--fixture-base-url", "http://host.docker.internal:8791"]);
} catch (error) {
  console.error(workerLogs);
  throw error;
} finally {
  const exited = worker.exitCode !== null ? Promise.resolve() : once(worker, "exit");
  try {
    if (process.platform === "win32") worker.kill("SIGTERM");
    else process.kill(-worker.pid, "SIGTERM");
  } catch {}
  await Promise.race([exited, delay(3000)]);
  if (worker.exitCode === null) {
    try {
      if (process.platform === "win32") worker.kill("SIGKILL");
      else process.kill(-worker.pid, "SIGKILL");
    } catch {}
  }
  fixture.closeAllConnections();
  await new Promise((resolve) => fixture.close(resolve));
}
