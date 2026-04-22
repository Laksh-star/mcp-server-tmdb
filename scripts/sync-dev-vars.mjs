#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envPath = ".env";
const devVarsPath = ".dev.vars";

if (!existsSync(envPath)) {
  process.exit(0);
}

const envText = readFileSync(envPath, "utf8");
const lines = envText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && line.includes("="));

if (lines.length === 0) {
  process.exit(0);
}

writeFileSync(devVarsPath, `${lines.join("\n")}\n`, { mode: 0o600 });
console.log(`Synced ${lines.length} local env value${lines.length === 1 ? "" : "s"} to ${devVarsPath}.`);
