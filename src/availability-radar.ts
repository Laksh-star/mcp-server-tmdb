import { z } from "zod";

interface Env { TMDB_API_KEY?: string; TMDB_BASE_URL?: string }
const identity = { id: z.number().int().positive(), mediaType: z.enum(["movie", "tv"]) };
const providerSchema = z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(120) });
const listingsSchema = z.object({ streaming: z.array(providerSchema).max(150), rent: z.array(providerSchema).max(150), buy: z.array(providerSchema).max(150) });
const timestamp = z.string().datetime({ offset: true });
export const radarSnapshotSchema = z.object({
  version: z.literal(1), country: z.string().regex(/^[A-Z]{2}$/),
  items: z.array(z.object({ ...identity, checkedAt: timestamp, providers: listingsSchema })).max(50),
});
export const availabilityRadarInputSchema = z.object({
  titles: z.array(z.object({ ...identity, title: z.string().trim().min(1).max(300).optional() })).min(1).max(50)
    .describe("Up to 50 saved movies/TV series identified by TMDB IDs; optional titles are display labels"),
  country: z.string().regex(/^[a-zA-Z]{2}$/).default("IN"),
  services: z.array(z.string().trim().min(1).max(80)).max(10).default([])
    .describe("Services to highlight; does not filter the stored baseline"),
  previousSnapshot: radarSnapshotSchema.optional().describe("Caller-owned baseline from a previous check. Omit to create a baseline"),
});

type Snapshot = z.infer<typeof radarSnapshotSchema>;
type Listings = z.infer<typeof listingsSchema>;
type Category = keyof Listings;
const categories: Category[] = ["streaming", "rent", "buy"];
const keyFor = (item: { mediaType: string; id: number }) => `${item.mediaType}:${item.id}`;
const serviceKey = (value: string) => {
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = { amazonprimevideo: "primevideo", disneyplus: "disney", hbomax: "max" };
  return aliases[key] || key;
};

export interface RadarEntry {
  id: number; mediaType: "movie" | "tv"; title: string;
  status: "baseline" | "changed" | "unchanged" | "no-data" | "failed";
  checkedAt?: string; previousCheckedAt?: string;
  providers?: Listings;
  changes: Array<{ category: Category; added: Listings[Category]; removed: Listings[Category] }>;
  newOnServices: string[];
  link?: string;
  note?: string;
}

async function fetchListings(env: Env, endpoint: string): Promise<unknown> {
  if (!env.TMDB_API_KEY) throw new Error("TMDB_API_KEY is not configured.");
  const url = new URL(`${env.TMDB_BASE_URL || "https://api.themoviedb.org/3"}${endpoint}`);
  url.searchParams.set("api_key", env.TMDB_API_KEY);
  // One request per title keeps a 50-title check within a Worker's subrequest budget.
  // Failures retain the caller's last successful baseline and can be retried next check.
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("TMDB request failed.");
    return await response.json();
  } catch { throw new Error("Provider lookup failed; the previous baseline was kept."); }
}

function readRegion(payload: unknown, country: string): { providers: Listings; link?: string } | undefined {
  const provider = z.object({ provider_id: z.number().int().positive(), provider_name: z.string().trim().min(1).max(120) });
  const region = z.object({ link: z.string().optional(), flatrate: z.array(provider).max(150).optional(), rent: z.array(provider).max(150).optional(), buy: z.array(provider).max(150).optional() });
  const parsed = z.object({ results: z.record(z.string(), region) }).parse(payload);
  const data = parsed.results[country];
  if (!data || ![data.flatrate, data.rent, data.buy].some(Array.isArray)) return undefined;
  const clean = (values: z.infer<typeof provider>[] = []) => [...new Map(values.map((value) => [value.provider_id, { id: value.provider_id, name: value.provider_name }])).values()].sort((a, b) => a.id - b.id);
  return { providers: { streaming: clean(data.flatrate), rent: clean(data.rent), buy: clean(data.buy) }, link: data.link };
}

export async function checkWatchlistAvailability(env: Env, rawInput: unknown) {
  const input = availabilityRadarInputSchema.parse(rawInput);
  if (!env.TMDB_API_KEY) throw new Error("TMDB_API_KEY is not configured.");
  const country = input.country.toUpperCase();
  const titles = [...new Map(input.titles.map((item) => [keyFor(item), item])).values()];
  const previous = input.previousSnapshot?.country === country ? input.previousSnapshot : undefined;
  const previousByKey = new Map(previous?.items.map((item) => [keyFor(item), item]));
  const snapshot: Snapshot = { version: 1, country, items: [] };
  const results: RadarEntry[] = new Array(titles.length);
  const snapshots: Array<Snapshot["items"][number] | undefined> = new Array(titles.length);
  let next = 0;
  async function worker() {
    while (next < titles.length) {
      const index = next++;
      const title = titles[index];
      const old = previousByKey.get(keyFor(title));
      const entry: RadarEntry = { ...title, title: title.title || `${title.mediaType === "tv" ? "TV" : "Movie"} #${title.id}`, status: "failed", changes: [], newOnServices: [], previousCheckedAt: old?.checkedAt };
      try {
        const current = readRegion(await fetchListings(env, `/${title.mediaType}/${title.id}/watch/providers`), country);
        if (!current) {
          entry.status = "no-data";
          entry.note = "TMDB returned no provider data for this country. This does not confirm a removal; the previous baseline was kept.";
          snapshots[index] = old;
        } else {
          entry.checkedAt = new Date().toISOString();
          entry.providers = current.providers;
          entry.link = current.link;
          snapshots[index] = { id: title.id, mediaType: title.mediaType, checkedAt: entry.checkedAt, providers: current.providers };
          if (!old) {
            entry.status = "baseline";
            entry.note = "Baseline created. These are current listings, not newly added titles.";
          } else {
            entry.changes = categories.map((category) => {
              const oldIds = new Set(old.providers[category].map((provider) => provider.id));
              const newIds = new Set(current.providers[category].map((provider) => provider.id));
              return { category, added: current.providers[category].filter((provider) => !oldIds.has(provider.id)), removed: old.providers[category].filter((provider) => !newIds.has(provider.id)) };
            }).filter((change) => change.added.length || change.removed.length);
            entry.status = entry.changes.length ? "changed" : "unchanged";
            entry.newOnServices = (entry.changes.find((change) => change.category === "streaming")?.added || [])
              .filter((provider) => !input.services.length || input.services.some((service) => serviceKey(service) === serviceKey(provider.name)))
              .map((provider) => provider.name);
          }
        }
      } catch {
        entry.note = "Provider lookup failed or returned invalid data. The previous baseline was kept; retry this title later.";
        snapshots[index] = old;
      }
      results[index] = entry;
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, titles.length) }, worker));
  snapshot.items = snapshots.filter((item): item is Snapshot["items"][number] => Boolean(item));
  return {
    generatedAt: new Date().toISOString(), country, services: input.services, entries: results, snapshot,
    summary: {
      checked: results.filter((entry) => ["baseline", "changed", "unchanged"].includes(entry.status)).length,
      newlyOnServices: results.filter((entry) => entry.newOnServices.length).length,
      changed: results.filter((entry) => entry.status === "changed").length,
      baselines: results.filter((entry) => entry.status === "baseline").length,
      unchecked: results.filter((entry) => ["no-data", "failed"].includes(entry.status)).length,
    },
    notes: [
      ...(input.previousSnapshot && !previous ? ["Country changed: this check creates a new baseline for the selected country."] : []),
      "Changes are observations since each title's last successful check, not exact arrival or departure times.",
      "Missing country data and failed requests do not count as removals. Rental and purchase listings are separate from subscriptions.",
      "Availability: TMDB / JustWatch. TV series listings may not cover every season. Prices and future leaving dates are not provided.",
      "This tool does not store your watchlist or schedule notifications. Keep the returned snapshot in your client for the next check.",
    ],
  };
}

export function availabilityRadarSummary(result: Awaited<ReturnType<typeof checkWatchlistAvailability>>): string {
  return `Personal Availability Radar (${result.country})\n` +
    `Checked: ${result.summary.checked} · Newly on services: ${result.summary.newlyOnServices} · Changed: ${result.summary.changed} · Baselines: ${result.summary.baselines} · Unchecked: ${result.summary.unchecked}\n\n` +
    result.entries.map((entry) => `${entry.title} — ${entry.mediaType} ID ${entry.id} · ${entry.status}\n` +
      (entry.newOnServices.length ? `New subscription listings: ${entry.newOnServices.join(", ")}\n` : "") +
      (entry.providers ? `Subscription: ${entry.providers.streaming.map((provider) => provider.name).join(", ") || "none listed"}\nRent: ${entry.providers.rent.map((provider) => provider.name).join(", ") || "none listed"} · Buy: ${entry.providers.buy.map((provider) => provider.name).join(", ") || "none listed"}\n` : "") +
      entry.changes.map((change) => `${change.category}: added ${change.added.map((provider) => provider.name).join(", ") || "none"}; removed ${change.removed.map((provider) => provider.name).join(", ") || "none"}`).join("\n") +
      (entry.note ? `\n${entry.note}` : "")).join("\n---\n") + `\n\n${result.notes.join("\n")}`;
}
