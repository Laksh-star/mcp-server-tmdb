import { z } from "zod";
import { availabilityRadarInputSchema, checkWatchlistAvailability } from "./availability-radar.js";

interface Env { TMDB_API_KEY?: string; TMDB_BASE_URL?: string }
export const streamingCoverageInputSchema = z.object({
  titles: availabilityRadarInputSchema.shape.titles,
  country: availabilityRadarInputSchema.shape.country,
  services: z.array(z.string().trim().min(1).max(80)).max(20).default([]).describe("Subscription services you already have, matched by name; variants remain distinct"),
  subscribedProviderIds: z.array(z.number().int().positive()).max(30).default([]).describe("Optional exact TMDB provider IDs for subscriptions you already have"),
  maxAdditionalServices: z.number().int().min(0).max(3).default(2).describe("Maximum additional services in the greedy coverage suggestion; this is not a price optimizer"),
  maxResults: z.number().int().min(1).max(25).default(10).describe("Number of service coverage rows to return"),
});

interface Title { id: number; mediaType: "movie" | "tv"; title: string }
const titleKey = (title: Title) => `${title.mediaType}:${title.id}`;
const serviceKey = (value: string) => {
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = { amazonprimevideo: "primevideo", disneyplus: "disney", hbomax: "max" };
  return aliases[key] || key;
};

export async function planStreamingCoverage(env: Env, rawInput: unknown) {
  const input = streamingCoverageInputSchema.parse(rawInput);
  const availability = await checkWatchlistAvailability(env, { titles: input.titles, country: input.country });
  const titles: Title[] = availability.entries.map((entry) => ({ id: entry.id, mediaType: entry.mediaType, title: entry.title }));
  const byKey = new Map(titles.map((title) => [titleKey(title), title]));
  const known = availability.entries.filter((entry) => Boolean(entry.providers));
  const unknownTitles = availability.entries.filter((entry) => !entry.providers).map(({ id, mediaType, title }) => ({ id, mediaType, title }));
  const providers = new Map<number, { id: number; name: string; keys: Set<string> }>();
  for (const entry of known) {
    for (const provider of entry.providers!.streaming) {
      if (!providers.has(provider.id)) providers.set(provider.id, { ...provider, keys: new Set() });
      providers.get(provider.id)!.keys.add(titleKey(entry));
    }
  }
  const catalog = [...providers.values()].sort((a, b) => b.keys.size - a.keys.size || a.id - b.id);
  const subscribedIds = new Set(input.subscribedProviderIds);
  const selected = catalog.filter((provider) => subscribedIds.has(provider.id) || input.services.some((service) => serviceKey(service) === serviceKey(provider.name)));
  const union = (items: typeof catalog) => new Set(items.flatMap((provider) => [...provider.keys]));
  const currentKeys = union(selected);
  const selectionKeys = new Set(currentKeys);
  const chosen: typeof catalog = [];
  const additions: Array<{ id: number; name: string; additionalCount: number; additionalTitles: Title[] }> = [];
  for (let step = 0; step < input.maxAdditionalServices; step++) {
    let best: (typeof catalog)[number] | undefined;
    let bestGain: string[] = [];
    for (const provider of catalog) {
      if (selected.includes(provider) || chosen.includes(provider)) continue;
      const gain = [...provider.keys].filter((key) => !selectionKeys.has(key));
      if (gain.length > bestGain.length || (gain.length > 0 && gain.length === bestGain.length && best && provider.id < best.id)) { best = provider; bestGain = gain; }
    }
    if (!best) break;
    chosen.push(best);
    for (const key of bestGain) selectionKeys.add(key);
    additions.push({ id: best.id, name: best.name, additionalCount: bestGain.length, additionalTitles: bestGain.map((key) => byKey.get(key)!) });
  }
  const toTitles = (keys: Set<string>) => titles.filter((title) => keys.has(titleKey(title)));
  const percentage = (count: number) => Math.round(count / titles.length * 100);
  const rows = catalog.slice(0, input.maxResults).map((provider) => {
    const coveredTitles = toTitles(provider.keys);
    const overlap = coveredTitles.filter((title) => currentKeys.has(titleKey(title)));
    return {
      id: provider.id, name: provider.name, coveredCount: coveredTitles.length, coveragePercent: percentage(coveredTitles.length),
      alreadySubscribed: selected.includes(provider), overlapWithCurrentCount: overlap.length,
      additionalCount: coveredTitles.length - overlap.length, coveredTitles,
    };
  });
  return {
    generatedAt: availability.generatedAt, country: availability.country,
    totalTitles: titles.length, checkedTitles: known.length, unknownTitles,
    current: { services: selected.map(({ id, name }) => ({ id, name })), coveredCount: currentKeys.size, coveragePercent: percentage(currentKeys.size), coveredTitles: toTitles(currentKeys) },
    suggestion: {
      method: "greedy" as const, maxAdditionalServices: input.maxAdditionalServices, additions,
      coveredCount: selectionKeys.size, coveragePercent: percentage(selectionKeys.size), coveredTitles: toTitles(selectionKeys),
    },
    services: rows, totalServices: catalog.length,
    unlistedOnSubscriptions: known.filter((entry) => entry.providers!.streaming.length === 0).map(({ id, mediaType, title }) => ({ id, mediaType, title })),
    uncoveredTitles: known.filter((entry) => !selectionKeys.has(titleKey(entry))).map(({ id, mediaType, title }) => ({ id, mediaType, title })),
    unmatchedServices: input.services.filter((service) => !selected.some((provider) => serviceKey(provider.name) === serviceKey(service))),
    unmatchedProviderIds: input.subscribedProviderIds.filter((id) => !selected.some((provider) => provider.id === id)),
    notes: [
      "Counts use subscription listings only; rentals and purchases do not count as subscription coverage.",
      "Percentages use all requested titles. Failed or missing-country checks are shown as unknown, not confirmed unavailable.",
      "Suggestions add the service covering the most remaining titles at each step. This may not be the smallest or cheapest combination.",
      "Compare subscription prices and plan details separately. Provider variants and add-on channels remain distinct.",
      "Availability: TMDB / JustWatch; region and date matter. Series-level listings may not cover every season.",
      ...(known.length < titles.length ? [`Availability could not be checked for ${titles.length - known.length} titles; coverage is incomplete.`] : []),
    ],
  };
}

export function streamingCoverageSummary(result: Awaited<ReturnType<typeof planStreamingCoverage>>): string {
  return `Streaming Service Coverage (${result.country})\n` +
    `Saved titles: ${result.totalTitles} · Checked: ${result.checkedTitles} · Unknown: ${result.unknownTitles.length}\n` +
    `Current subscriptions cover ${result.current.coveredCount}/${result.totalTitles} (${result.current.coveragePercent}%).\n` +
    `With suggested additions: ${result.suggestion.coveredCount}/${result.totalTitles} (${result.suggestion.coveragePercent}%).\n\n` +
    `Suggested additions (by additional title coverage):\n${result.suggestion.additions.map((service) => `- ${service.name} (provider ${service.id}): ${service.additionalCount} additional titles`).join("\n") || "None improve coverage with the current constraints."}\n\n` +
    `Service comparison:\n${result.services.map((service) => `- ${service.name} (provider ${service.id}): ${service.coveredCount} titles, ${service.additionalCount} additional vs current, ${service.overlapWithCurrentCount} overlap${service.alreadySubscribed ? "; already selected" : ""}`).join("\n") || "No subscription providers found in the checked listings."}\n\n` +
    `Outside selected/suggested subscriptions: ${result.uncoveredTitles.map((title) => title.title).join(", ") || "none in checked data"}\n` +
    `Unknown availability: ${result.unknownTitles.map((title) => title.title).join(", ") || "none"}\n\n${result.notes.join("\n")}`;
}
