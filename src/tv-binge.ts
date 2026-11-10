import { z } from "zod";

interface Env { TMDB_API_KEY?: string; TMDB_BASE_URL?: string }

export const tvBingeInputSchema = z.object({
  country: z.string().regex(/^[a-zA-Z]{2}$/).default("IN").describe("Two-letter country for streaming availability"),
  language: z.string().regex(/^(any|[a-z]{2})$/).default("any").describe("Original language code, or any"),
  genre: z.string().trim().max(80).default("").describe("TV genre; thriller uses Crime and Mystery"),
  maxHours: z.number().min(1).max(300).default(12).describe("Maximum estimated whole-series viewing hours"),
  minutesPerDay: z.number().int().min(15).max(720).default(120).describe("Daily viewing budget, used to estimate days to finish"),
  completedOnly: z.boolean().default(true).describe("Only Ended series; Cancelled does not count as completed"),
  services: z.array(z.string().trim().min(1).max(80)).max(10).default([]).describe("Require a subscription match on one of these services; omit to search all"),
  minRating: z.number().min(0).max(9).default(7).describe("Minimum TMDB rating"),
  maxResults: z.number().int().min(1).max(8).default(5),
  excludeTVIds: z.array(z.number().int().positive()).max(2000).default([]).describe("Watched or unwanted TMDB TV IDs to omit; supplied by the caller"),
});

interface TVSummary { id: number; name: string; original_language?: string; vote_average: number; vote_count?: number; first_air_date?: string }
interface TVDetails extends TVSummary {
  status: string;
  number_of_episodes: number;
  number_of_seasons: number;
  episode_run_time?: number[];
  overview?: string;
  genres?: Array<{ id: number; name: string }>;
  "watch/providers"?: { results: Record<string, { flatrate?: Array<{ provider_name: string }>; rent?: Array<{ provider_name: string }>; buy?: Array<{ provider_name: string }>; link?: string }> };
}

export interface TVBingePick {
  id: number;
  title: string;
  mediaType: "tv";
  year: string;
  rating: number;
  status: string;
  episodes: number;
  seasons: number;
  estimatedRuntimeMinutes: number;
  runtimeBasis: "series-average" | "assumed-45-minutes";
  estimatedDays: number;
  providers: { streaming: string[]; rent: string[]; buy: string[]; link?: string };
  reasons: string[];
  overview: string;
  score: number;
}

async function tmdb<T>(env: Env, endpoint: string, params: Record<string, string> = {}): Promise<T> {
  if (!env.TMDB_API_KEY) throw new Error("TMDB_API_KEY is not configured.");
  const url = new URL(`${env.TMDB_BASE_URL || "https://api.themoviedb.org/3"}${endpoint}`);
  url.searchParams.set("api_key", env.TMDB_API_KEY);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  for (let attempt = 0; attempt < 3; attempt++) {
    // Do not include the URL or API key in errors.
    let response: Response;
    try { response = await fetch(url, { signal: AbortSignal.timeout(15_000) }); }
    catch {
      if (attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1))); continue; }
      throw new Error(`Unable to reach TMDB for ${endpoint}.`);
    }
    if (response.ok) return await response.json() as T;
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      continue;
    }
    throw new Error(`TMDB request failed for ${endpoint} (${response.status}).`);
  }
  throw new Error("TMDB is unavailable.");
}

const serviceKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
function matchesService(available: string, requested: string): boolean {
  // Keep channels, rentals, and add-on products distinct from base subscriptions.
  const aliases: Record<string, string> = { amazonprimevideo: "primevideo", disneyplus: "disney", hbomax: "max" };
  const key = (name: string) => aliases[serviceKey(name)] || serviceKey(name);
  return key(available) === key(requested);
}

export async function buildTVBingePlan(env: Env, rawInput: unknown) {
  const input = tvBingeInputSchema.parse(rawInput);
  const country = input.country.toUpperCase();
  const notes = [
    "Viewing times estimate the whole series using TMDB episode counts and runtimes. Episode lengths can vary.",
    "Ended is a TMDB status, not a guarantee that a story has a satisfying conclusion.",
    "Provider listings are regional series-level data and may not cover every season. Availability: TMDB / JustWatch.",
  ];
  let genreIds: number[] = [];
  if (input.genre) {
    const { genres } = await tmdb<{ genres: Array<{ id: number; name: string }> }>(env, "/genre/tv/list");
    const names = input.genre.toLowerCase() === "thriller" ? ["crime", "mystery"] : [input.genre.toLowerCase()];
    genreIds = genres.filter((genre) => names.includes(genre.name.toLowerCase())).map((genre) => genre.id);
    if (!genreIds.length) throw new Error(`Unknown TV genre. Choose from: ${genres.map((genre) => genre.name).join(", ")}.`);
    if (input.genre.toLowerCase() === "thriller") notes.push("TMDB has no TV Thriller genre; discovery uses Crime or Mystery.");
  }
  const params: Record<string, string> = {
    include_adult: "false", sort_by: "vote_average.desc", "vote_count.gte": "100",
    "vote_average.gte": String(input.minRating), watch_region: country,
  };
  if (input.completedOnly) params.with_status = "3";
  if (input.language !== "any") params.with_original_language = input.language;
  if (genreIds.length) params.with_genres = genreIds.join("|");
  const first = await tmdb<{ results: TVSummary[]; total_pages: number }>(env, "/discover/tv", params);
  let candidates = first.results;
  if (first.total_pages > 1) {
    try {
      const second = await tmdb<{ results: TVSummary[] }>(env, "/discover/tv", { ...params, page: "2" });
      candidates = [...candidates, ...second.results];
    } catch { notes.push("The second discovery page was unavailable; this shortlist uses the first page."); }
  }
  // High-rated general discovery is dominated by long-running shows. Reserve room
  // for miniseries so short viewing budgets get useful candidates too.
  try {
    const mini = await tmdb<{ results: TVSummary[] }>(env, "/discover/tv", { ...params, with_type: "2" });
    candidates = input.maxHours <= 24
      ? [...mini.results.slice(0, 16), ...candidates]
      : [...candidates.slice(0, 20), ...mini.results, ...candidates.slice(20)];
  } catch { notes.push("Miniseries discovery was unavailable; only general series were checked."); }
  const excluded = new Set(input.excludeTVIds);
  candidates = [...new Map(candidates.map((show) => [show.id, show])).values()].filter((show) => !excluded.has(show.id)).slice(0, 30);
  const settled = await Promise.allSettled(candidates.map((show) => tmdb<TVDetails>(env, `/tv/${show.id}`, { append_to_response: "watch/providers" })));
  const details = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (candidates.length && !details.length) throw new Error("TV details are unavailable. Try again later.");
  if (details.length < candidates.length) notes.push(`${candidates.length - details.length} series could not be checked and were omitted.`);
  const picks: TVBingePick[] = [];
  for (const show of details) {
    if (input.completedOnly && show.status !== "Ended") continue;
    if (show.vote_average < input.minRating || (input.language !== "any" && show.original_language !== input.language)) continue;
    if (genreIds.length && !show.genres?.some((genre) => genreIds.includes(genre.id))) continue;
    if (!Number.isInteger(show.number_of_episodes) || show.number_of_episodes < 1) continue;
    const runtimes = (show.episode_run_time || []).filter((value) => Number.isFinite(value) && value > 0);
    const perEpisode = runtimes.length ? runtimes.reduce((sum, value) => sum + value, 0) / runtimes.length : 45;
    const estimatedRuntimeMinutes = Math.ceil(perEpisode * show.number_of_episodes);
    if (estimatedRuntimeMinutes > input.maxHours * 60) continue;
    const providerData = show["watch/providers"]?.results[country];
    const streaming = providerData?.flatrate?.map((provider) => provider.provider_name) || [];
    const matched = streaming.filter((name) => input.services.some((service) => matchesService(name, service)));
    if (input.services.length && !matched.length) continue;
    const estimatedDays = Math.ceil(estimatedRuntimeMinutes / input.minutesPerDay);
    picks.push({
      id: show.id, title: show.name, mediaType: "tv", year: show.first_air_date?.slice(0, 4) || "unknown",
      rating: show.vote_average, status: show.status, episodes: show.number_of_episodes, seasons: show.number_of_seasons,
      estimatedRuntimeMinutes, runtimeBasis: runtimes.length ? "series-average" : "assumed-45-minutes", estimatedDays,
      providers: { streaming, rent: providerData?.rent?.map((provider) => provider.provider_name) || [], buy: providerData?.buy?.map((provider) => provider.provider_name) || [], link: providerData?.link },
      reasons: [
        `${show.status} · ${show.number_of_episodes} episodes`,
        `About ${estimatedDays} day${estimatedDays === 1 ? "" : "s"} at ${input.minutesPerDay} minutes/day`,
        runtimes.length ? "Time estimated from TMDB series episode runtimes" : "Runtime missing: assumes 45 minutes per episode",
        ...(matched.length ? [`Subscription match: ${matched.join(", ")}`] : []),
      ],
      overview: show.overview || "", score: Math.round(show.vote_average * 10 + (matched.length ? 15 : 0) + (show.status === "Ended" ? 5 : 0)),
    });
  }
  picks.sort((a, b) => b.score - a.score || a.estimatedRuntimeMinutes - b.estimatedRuntimeMinutes || a.id - b.id);
  const shortlist = picks.slice(0, input.maxResults);
  if (!shortlist.length) notes.push("No matches in the checked discovery pages. Try more hours, another service, or a broader genre/language.");
  return {
    generatedAt: new Date().toISOString(), country, language: input.language, maxHours: input.maxHours,
    minutesPerDay: input.minutesPerDay, completedOnly: input.completedOnly, services: input.services,
    picks: shortlist,
    decision: shortlist.length ? [`Start with ${shortlist[0].title}; about ${Math.round(shortlist[0].estimatedRuntimeMinutes / 6) / 10} hours in total.`] : ["No series matched these constraints."],
    notes,
  };
}

export function tvBingePlanSummary(result: Awaited<ReturnType<typeof buildTVBingePlan>>): string {
  return `TV Binge Planner (${result.country})\nBudget: ${result.maxHours} hours · ${result.minutesPerDay} minutes/day\n` +
    `Ended series only: ${result.completedOnly ? "yes" : "no"}\n\n` + result.picks.map((pick, index) =>
      `${index + 1}. ${pick.title} (${pick.year}) — TV ID: ${pick.id}\n` +
      `${pick.rating}/10 · ${pick.status} · ${pick.seasons} season${pick.seasons === 1 ? "" : "s"} · ${pick.episodes} episode${pick.episodes === 1 ? "" : "s"}\n` +
      `Estimated viewing time: ${pick.estimatedRuntimeMinutes} min · about ${pick.estimatedDays} days\n` +
      `${pick.reasons.join("; ")}\nSubscription: ${pick.providers.streaming.join(", ") || "none listed"}\n` +
      `Rent: ${pick.providers.rent.join(", ") || "none listed"} · Buy: ${pick.providers.buy.join(", ") || "none listed"}`
    ).join("\n---\n") + `\n\n${result.decision.join("\n")}\n\nNotes:\n${result.notes.join("\n")}`;
}
