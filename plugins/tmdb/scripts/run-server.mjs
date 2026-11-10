#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { localEnvironment } from "../../../scripts/local-environment.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
try {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error("Node.js 22.12 or later is required. Run npm run doctor after upgrading.");
  const { env } = localEnvironment(root);
  if (!env.TMDB_API_KEY?.trim() || /^(your_tmdb|fixture-key$|dummy$)/i.test(env.TMDB_API_KEY)) throw new Error("Configure TMDB_API_KEY in the client environment or the repo .env file. Run npm run doctor for details.");
  if (!fs.existsSync(path.join(root, "dist/index.js"))) throw new Error("Missing dist/index.js. Run npm install and npm run build, then restart the MCP client.");
  for (const key of ["TMDB_API_KEY", "TMDB_BASE_URL"]) if (env[key]) process.env[key] = env[key];
  await import(pathToFileURL(path.join(root, "dist/index.js")).href);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to start TMDB MCP. Run npm run doctor.");
  process.exitCode = 1;
}
