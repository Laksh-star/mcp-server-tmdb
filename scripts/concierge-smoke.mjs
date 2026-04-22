#!/usr/bin/env node

const baseUrl = process.argv[2] || "http://127.0.0.1:8787";
const endpoint = new URL("/api/concierge", baseUrl).toString();
const accessToken = process.env.TMDB_MCP_ACCESS_TOKEN || process.env.ACCESS_TOKEN;

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  },
  body: JSON.stringify({
    mood: "thriller",
    country: "IN",
    language: "any",
    runtime: "150",
    minRating: "6.5",
    services: ["Netflix", "Prime Video"],
  }),
});

const payload = await response.json().catch(() => null);

if (!response.ok) {
  throw new Error(`Concierge smoke failed with ${response.status}: ${JSON.stringify(payload)}`);
}

if (!payload?.picks?.length) {
  throw new Error("Concierge smoke returned no picks.");
}

console.log(`Connected to ${baseUrl}`);
console.log(`Generated ${payload.picks.length} picks for ${payload.country} / ${payload.mood}.`);
console.log(payload.picks.slice(0, 3).map((pick) => `- ${pick.title} (${pick.year}) ${pick.rating}/10`).join("\n"));
