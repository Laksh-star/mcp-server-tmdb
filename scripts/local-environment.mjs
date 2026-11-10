import fs from "node:fs";
import path from "node:path";
import * as util from "node:util";

/** Parse data only; explicit shell values win. Never source .env as shell code. */
export function localEnvironment(root, base = process.env) {
  const env = { ...base };
  const sources = {};
  for (const key of ["TMDB_API_KEY", "TMDB_BASE_URL"]) if (env[key]?.trim()) sources[key] = "environment";
  for (const filename of [".env", ".tmdb.env"]) {
    const file = path.join(root, filename);
    if (!fs.existsSync(file)) continue;
    if (typeof util.parseEnv !== "function") throw new Error("Node.js 22 or later is required to load local environment files.");
    let parsed;
    try { parsed = util.parseEnv(fs.readFileSync(file, "utf8")); }
    catch { throw new Error(`Unable to read ${filename}. Check the file permissions and format.`); }
    for (const key of ["TMDB_API_KEY", "TMDB_BASE_URL"]) {
      if (!env[key]?.trim() && parsed[key]?.trim()) { env[key] = parsed[key]; sources[key] = filename; }
    }
  }
  return { env, sources };
}
