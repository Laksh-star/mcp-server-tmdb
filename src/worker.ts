/// <reference types="@cloudflare/workers-types" />

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderConciergeApp } from "./concierge-app";
import { createWatchPartyPlanner, createWeekendConcierge } from "./concierge";
import { buildFranchiseWatchOrder, franchiseGuideSummary } from "./franchise";
import { buildPersonWatchPath, personWatchPathSummary } from "./person-path";
import { recommendFromTasteProfile, tasteProfileSummary } from "./taste";

interface Env {
  TMDB_API_KEY?: string;
  TMDB_BASE_URL?: string;
  ACCESS_TOKEN?: string;
}

interface Movie {
  id: number;
  title: string;
  release_date?: string;
  original_language?: string;
  vote_average: number;
  overview: string;
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
  credits?: {
    cast: Array<{ name: string; character: string }>;
    crew: Array<{ name: string; job: string }>;
  };
  reviews?: {
    results: Array<{ author: string; content: string; rating?: number }>;
  };
}

interface WeeklyTrendingMovie {
  id: number;
  title: string;
  year: string;
  rating: number;
}

interface WeeklyTrendingLanguageGroup {
  label: string;
  code: string;
  movies: WeeklyTrendingMovie[];
}

interface WeeklyTrendingLanguageResult {
  generatedAt: string;
  source: string;
  groups: WeeklyTrendingLanguageGroup[];
}

interface TMDBResponse {
  page: number;
  results: Movie[];
  total_pages: number;
  dates?: {
    minimum: string;
    maximum: string;
  };
}

interface Person {
  id: number;
  name: string;
  known_for_department: string;
  popularity: number;
  known_for: Movie[];
}

interface PersonResponse {
  page: number;
  results: Person[];
  total_pages: number;
}

interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday?: string;
  place_of_birth?: string;
  known_for_department: string;
  movie_credits?: {
    cast: Array<{ title: string; release_date?: string; character: string; vote_average?: number }>;
    crew: Array<{ title: string; release_date?: string; job: string }>;
  };
  tv_credits?: {
    cast: Array<{ name: string; first_air_date?: string; character: string }>;
  };
}

interface KeywordResponse {
  page: number;
  results: Array<{ id: number; name: string }>;
  total_pages: number;
}

interface TVShow {
  id: number;
  name: string;
  first_air_date?: string;
  vote_average: number;
  overview: string;
}

interface TVResponse {
  page: number;
  results: TVShow[];
  total_pages: number;
}

interface WatchProviderResult {
  link?: string;
  flatrate?: Array<{ provider_name: string }>;
  rent?: Array<{ provider_name: string }>;
  buy?: Array<{ provider_name: string }>;
}

interface WatchProvidersResponse {
  results: Record<string, WatchProviderResult>;
}

const READ_ONLY_TOOL = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

function yearFrom(value?: string): string {
  return value?.split("-")[0] || "unknown";
}

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    isError,
  };
}

function securityHeaders(): HeadersInit {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
}

function bearerTokenFor(request: Request): string | undefined {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function authorized(request: Request, env: Env): boolean {
  if (!env.ACCESS_TOKEN) return true;
  return bearerTokenFor(request) === env.ACCESS_TOKEN;
}

function unauthorizedResponse(): Response {
  return Response.json(
    { error: "Unauthorized. Provide the configured access token." },
    {
      status: 401,
      headers: {
        ...securityHeaders(),
        "www-authenticate": "Bearer",
        "access-control-allow-origin": "*",
      },
    },
  );
}

function movieList(movies: Movie[], limit = 10): string {
  return movies
    .slice(0, limit)
    .map((movie) =>
      `${movie.title} (${yearFrom(movie.release_date)}) - ID: ${movie.id}\n` +
      `Rating: ${movie.vote_average}/10\n` +
      `Overview: ${movie.overview}`
    )
    .join("\n---\n");
}

function providerNames(providers?: Array<{ provider_name: string }>): string[] {
  return providers?.map((provider) => provider.provider_name).filter(Boolean) || [];
}

function compareBestFor(movie: Movie, countryProviders?: WatchProviderResult): string {
  const genres = movie.genres?.map((genre) => genre.name.toLowerCase()) || [];
  const streaming = providerNames(countryProviders?.flatrate);

  if (streaming.length > 0) return "Best if you want something available on subscription streaming.";
  if (movie.runtime && movie.runtime <= 105) return "Best if you want the shortest, easiest watch.";
  if (movie.vote_average >= 8) return "Best if you want the strongest TMDB rating.";
  if (genres.some((genre) => ["action", "adventure", "comedy", "family", "animation"].includes(genre))) {
    return "Best for a lighter group watch.";
  }
  if (genres.some((genre) => ["drama", "history", "documentary"].includes(genre))) {
    return "Best for a more focused, thoughtful watch.";
  }

  return "Best as a balanced pick across rating, runtime, and genre fit.";
}

function renderMovieComparison(
  movies: Array<{ movie: Movie; providers?: WatchProviderResult }>,
  country: string,
): string {
  const lines = [
    `Movie comparison (${country})`,
    `Compared ${movies.length} movies by TMDB details and watch-provider availability.`,
    "",
  ];

  movies.forEach(({ movie, providers }, index) => {
    const director = movie.credits?.crew?.find((person) => person.job === "Director")?.name;
    const cast = movie.credits?.cast?.slice(0, 4).map((person) => person.name).join(", ");
    const streaming = providerNames(providers?.flatrate);
    const rent = providerNames(providers?.rent);
    const buy = providerNames(providers?.buy);
    const availability = [
      streaming.length > 0 ? `Streaming: ${streaming.join(", ")}` : null,
      rent.length > 0 ? `Rent: ${rent.slice(0, 4).join(", ")}` : null,
      buy.length > 0 ? `Buy: ${buy.slice(0, 4).join(", ")}` : null,
    ].filter(Boolean).join("\n");

    lines.push(
      `${index + 1}. ${movie.title} (${yearFrom(movie.release_date)}) - ID: ${movie.id}`,
      `Rating: ${movie.vote_average}/10`,
      movie.runtime ? `Runtime: ${movie.runtime} min` : "Runtime: unknown",
      movie.genres?.length ? `Genres: ${movie.genres.map((genre) => genre.name).join(", ")}` : "Genres: unknown",
      director ? `Director: ${director}` : "Director: unknown",
      cast ? `Cast: ${cast}` : "Cast: unknown",
      availability || `Availability: no providers found for ${country}`,
      `Best for: ${compareBestFor(movie, providers)}`,
      `Overview: ${movie.overview}`,
      "",
      "---",
      "",
    );
  });

  const sortedByRating = [...movies].sort((a, b) => b.movie.vote_average - a.movie.vote_average);
  const streamingPicks = movies.filter(({ providers }) => providerNames(providers?.flatrate).length > 0);
  const shortest = [...movies]
    .filter(({ movie }) => movie.runtime)
    .sort((a, b) => (a.movie.runtime || 0) - (b.movie.runtime || 0))[0];

  lines.push("Quick decision");
  lines.push(`- Highest rated: ${sortedByRating[0].movie.title} (${sortedByRating[0].movie.vote_average}/10)`);
  if (shortest) lines.push(`- Shortest runtime: ${shortest.movie.title} (${shortest.movie.runtime} min)`);
  if (streamingPicks.length > 0) {
    lines.push(`- Streaming in ${country}: ${streamingPicks.map(({ movie }) => movie.title).join(", ")}`);
  } else {
    lines.push(`- Streaming in ${country}: none found in TMDB provider data`);
  }

  return lines.join("\n");
}

function serviceMatches(available: string[], requested: string[]): string[] {
  if (requested.length === 0) return [];
  const normalizedRequested = requested.map((service) => service.toLowerCase());
  return available.filter((provider) =>
    normalizedRequested.some((service) => provider.toLowerCase().includes(service)),
  );
}

function renderProviderBlock(providers?: WatchProviderResult): {
  lines: string[];
  allProviderNames: string[];
} {
  const streaming = providerNames(providers?.flatrate);
  const rent = providerNames(providers?.rent);
  const buy = providerNames(providers?.buy);
  const lines = [
    streaming.length > 0 ? `Streaming: ${streaming.join(", ")}` : null,
    rent.length > 0 ? `Rent: ${rent.slice(0, 5).join(", ")}` : null,
    buy.length > 0 ? `Buy: ${buy.slice(0, 5).join(", ")}` : null,
    providers?.link ? `TMDB watch link: ${providers.link}` : null,
  ].filter((line): line is string => Boolean(line));

  return {
    lines,
    allProviderNames: [...streaming, ...rent, ...buy],
  };
}

function renderWhereToWatch(
  matches: Array<{ query: string; movie?: Movie; providers?: WatchProviderResult }>,
  country: string,
  requestedServices: string[],
): string {
  const lines = [
    `Where to watch (${country})`,
    requestedServices.length > 0
      ? `Preferred services: ${requestedServices.join(", ")}`
      : "Preferred services: any",
    "",
  ];
  const serviceMatchedTitles: string[] = [];

  matches.forEach(({ query, movie, providers }, index) => {
    lines.push(`${index + 1}. ${query}`);

    if (!movie) {
      lines.push("No TMDB movie match found.", "");
      return;
    }

    const providerBlock = renderProviderBlock(providers);
    const matchedServices = serviceMatches(providerBlock.allProviderNames, requestedServices);
    if (matchedServices.length > 0) serviceMatchedTitles.push(`${movie.title} via ${matchedServices.join(", ")}`);

    lines.push(
      `Matched: ${movie.title} (${yearFrom(movie.release_date)}) - ID: ${movie.id}`,
      `Rating: ${movie.vote_average}/10`,
      providerBlock.lines.length > 0
        ? providerBlock.lines.join("\n")
        : `No watch providers found for ${country}.`,
    );
    if (requestedServices.length > 0) {
      lines.push(
        matchedServices.length > 0
          ? `Preferred service match: ${matchedServices.join(", ")}`
          : "Preferred service match: none found",
      );
    }
    lines.push("");
  });

  lines.push("Quick decision");
  if (serviceMatchedTitles.length > 0) {
    lines.push(`- Preferred-service matches: ${serviceMatchedTitles.join("; ")}`);
  } else if (requestedServices.length > 0) {
    lines.push("- Preferred-service matches: none found in TMDB provider data");
  }

  const anyAvailability = matches
    .filter(({ providers }) => renderProviderBlock(providers).allProviderNames.length > 0)
    .map(({ movie }) => movie?.title)
    .filter(Boolean);
  lines.push(
    anyAvailability.length > 0
      ? `- Any availability found: ${anyAvailability.join(", ")}`
      : `- Any availability found: none for ${country}`,
  );

  return lines.join("\n");
}

const WEEKLY_TRENDING_LANGUAGES = [
  { label: "English", code: "en" },
  { label: "Hindi", code: "hi" },
  { label: "Telugu", code: "te" },
];

function weeklyTrendingByLanguageData(movies: Movie[]): WeeklyTrendingLanguageResult {
  return {
    generatedAt: new Date().toISOString(),
    source: "TMDB /trending/movie/week, first results page",
    groups: WEEKLY_TRENDING_LANGUAGES.map((language) => ({
      ...language,
      movies: movies
        .filter((movie) => movie.original_language === language.code)
        .map((movie) => ({
          id: movie.id,
          title: movie.title,
          year: yearFrom(movie.release_date),
          rating: movie.vote_average,
        })),
    })),
  };
}

function weeklyTrendingByLanguageList(result: WeeklyTrendingLanguageResult): string {
  const lines = [
    "Weekly trending movies by original language",
    `Source: ${result.source}`,
  ];

  for (const group of result.groups) {
    lines.push("", `${group.label} (${group.code})`);

    if (group.movies.length === 0) {
      lines.push("- No movies in the current weekly trending top results.");
      continue;
    }

    group.movies.forEach((movie, index) => {
      lines.push(
        `${index + 1}. ${movie.title} (${movie.year}) - ID: ${movie.id} - Rating: ${movie.rating}/10`,
      );
    });
  }

  return lines.join("\n");
}

async function getWeeklyTrendingByLanguage(env: Env): Promise<WeeklyTrendingLanguageResult> {
  const data = await fetchFromTMDB<TMDBResponse>(env, "/trending/movie/week");
  return weeklyTrendingByLanguageData(data.results);
}

function tvList(shows: TVShow[], limit = 10): string {
  return shows
    .slice(0, limit)
    .map((show) =>
      `${show.name} (${yearFrom(show.first_air_date)}) - ID: ${show.id}\n` +
      `Rating: ${show.vote_average}/10\n` +
      `Overview: ${show.overview}`
    )
    .join("\n---\n");
}

function conciergeSummary(result: Awaited<ReturnType<typeof createWeekendConcierge>>): string {
  const picks = result.picks
    .map((pick, index) => {
      const providers = pick.providers.streaming.length > 0
        ? `Streaming: ${pick.providers.streaming.join(", ")}`
        : "Streaming: no subscription provider found";
      const facts = [
        `${pick.year}`,
        `${pick.rating.toFixed(1)}/10`,
        pick.runtime ? `${pick.runtime} min` : null,
        pick.genres.length > 0 ? pick.genres.slice(0, 3).join(", ") : null,
      ].filter(Boolean).join(" | ");

      return `${index + 1}. ${pick.title} - ID: ${pick.id}\n` +
        `${facts}\n` +
        `${providers}\n` +
        `Why: ${pick.reasons.join("; ")}\n` +
        `Overview: ${pick.overview}`;
    })
    .join("\n---\n");

  const notes = result.notes.length > 0 ? `\n\nNotes:\n${result.notes.map((note) => `- ${note}`).join("\n")}` : "";

  return `Weekend Watch Concierge picks\n` +
    `Mood: ${result.mood}\n` +
    `Country: ${result.country}\n` +
    `Language: ${result.language}\n\n` +
    `${picks || "No matching picks found."}` +
    notes;
}

function watchPartyPlanSummary(result: Awaited<ReturnType<typeof createWatchPartyPlanner>>): string {
  const picks = result.picks
    .map((pick, index) => {
      const providers = pick.providers.streaming.length > 0
        ? `Streaming: ${pick.providers.streaming.join(", ")}`
        : "Streaming: no subscription provider found";
      const facts = [
        `${pick.year}`,
        `${pick.rating.toFixed(1)}/10`,
        pick.runtime ? `${pick.runtime} min` : null,
        pick.genres.length > 0 ? pick.genres.slice(0, 3).join(", ") : null,
      ].filter(Boolean).join(" | ");

      return `${index + 1}. ${pick.partyRole}: ${pick.title} - ID: ${pick.id}\n` +
        `${facts}\n` +
        `${providers}\n` +
        `Party fit: ${pick.partyFit}\n` +
        `Why: ${pick.reasons.join("; ")}\n` +
        `Overview: ${pick.overview}`;
    })
    .join("\n---\n");

  const notes = result.notes.length > 0 ? `\n\nNotes:\n${result.notes.map((note) => `- ${note}`).join("\n")}` : "";

  return `Watch Party Planner\n` +
    `Group size: ${result.groupSize}\n` +
    `Country: ${result.country}\n` +
    `Language: ${result.language}\n` +
    `Moods: ${result.moods.join(", ")}\n\n` +
    `Decision:\n${result.decision.map((line) => `- ${line}`).join("\n")}\n\n` +
    `${picks || "No matching party picks found."}` +
    notes;
}

async function fetchFromTMDB<T>(
  env: Env,
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
  if (!env.TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not configured on this Worker.");
  }

  const baseUrl = env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.set("api_key", env.TMDB_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (attempt < 3 && (response.status === 429 || response.status >= 500)) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 400));
          continue;
        }
        throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
      }
      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function genreIdFor(env: Env, genre: string): Promise<{ id?: number; available: string[] }> {
  const data = await fetchFromTMDB<{ genres: Array<{ id: number; name: string }> }>(
    env,
    "/genre/movie/list",
  );
  const match = data.genres.find((item) => item.name.toLowerCase() === genre.toLowerCase());
  return {
    id: match?.id,
    available: data.genres.map((item) => item.name),
  };
}

function createTMDBServer(env: Env): McpServer {
  const server = new McpServer({
    name: "tmdb-cloudflare",
    version: "2.0.0",
  });

  server.registerTool(
    "get_weekend_watchlist",
    {
      description: "Generate a ranked movie shortlist for a weekend watch session using mood, country, language, runtime, rating, and streaming services",
      inputSchema: {
        mood: z
          .enum(["crowd", "thriller", "thoughtful", "funny", "family", "mindbend"])
          .optional()
          .describe("Viewing mood. Defaults to crowd."),
        country: z.string().optional().describe("ISO 3166-1 country code for watch providers, defaults to IN"),
        language: z.string().optional().describe("Original language code such as en, hi, ta, te, ko, or any"),
        runtime: z.string().optional().describe("Maximum runtime in minutes, or any"),
        minRating: z.string().optional().describe("Minimum TMDB rating from 0 to 9, defaults to 6.5"),
        services: z.array(z.string()).optional().describe("Preferred streaming services, for example Netflix or Prime Video"),
        familySafe: z.string().optional().describe("When true, exclude common mature genres such as horror, thriller, crime, and war"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ mood, country, language, runtime, minRating, services, familySafe }) => {
      const result = await createWeekendConcierge(env, {
        mood,
        country,
        language,
        runtime,
        minRating,
        services,
        familySafe,
      });
      return textResult(conciergeSummary(result));
    },
  );

  server.registerTool(
    "plan_watch_party",
    {
      description: "Plan a group movie night by merging mood scans, provider availability, runtime fit, ratings, and avoided titles into a primary pick, backup pick, and wildcard",
      inputSchema: {
        moods: z
          .array(z.enum(["crowd", "thriller", "thoughtful", "funny", "family", "mindbend"]))
          .max(3)
          .optional()
          .describe("One to three viewing moods to balance for the group. Defaults to crowd."),
        groupSize: z.string().optional().describe("Number of people watching. Defaults to 4."),
        country: z.string().optional().describe("ISO 3166-1 country code for watch providers, defaults to IN"),
        language: z.string().optional().describe("Original language code such as en, hi, ta, te, ko, or any"),
        runtime: z.string().optional().describe("Maximum runtime in minutes, or any. Defaults tighter for larger groups."),
        minRating: z.string().optional().describe("Minimum TMDB rating from 0 to 9, defaults to 6.8"),
        services: z.array(z.string()).optional().describe("Preferred streaming services, for example Netflix or Prime Video"),
        avoidTitles: z.array(z.string()).optional().describe("Titles the group has already seen or wants to avoid"),
        familySafe: z.string().optional().describe("When true, exclude common mature genres such as horror, thriller, crime, and war"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ moods, groupSize, country, language, runtime, minRating, services, avoidTitles, familySafe }) => {
      const result = await createWatchPartyPlanner(env, {
        moods,
        groupSize,
        country,
        language,
        runtime,
        minRating,
        services,
        avoidTitles,
        familySafe,
      });
      return textResult(watchPartyPlanSummary(result));
    },
  );

  server.registerTool(
    "build_franchise_watch_order",
    {
      description: "Build a franchise or universe watch guide with release order, suggested order, total runtime, provider availability, and start/skip guidance",
      inputSchema: {
        query: z.string().describe("Franchise or collection query, for example The Matrix, Dune, Batman, or Mission Impossible"),
        country: z.string().optional().describe("ISO 3166-1 country code for watch-provider availability, defaults to IN"),
        maxMovies: z.string().optional().describe("Maximum number of collection entries to include, from 2 to 20. Defaults to 12"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ query, country, maxMovies }) => {
      const result = await buildFranchiseWatchOrder(env, {
        query,
        country,
        maxMovies,
      });
      return textResult(franchiseGuideSummary(result));
    },
  );

  server.registerTool(
    "recommend_from_taste_profile",
    {
      description: "Recommend movies from liked and disliked titles with provider-aware scoring, match reasons, and watch-out notes",
      inputSchema: {
        likedTitles: z.array(z.string()).min(1).max(5).describe("Movies the user likes. At least one is required."),
        dislikedTitles: z.array(z.string()).max(5).optional().describe("Movies the user dislikes or wants to avoid stylistically"),
        country: z.string().optional().describe("ISO 3166-1 country code for watch-provider availability, defaults to IN"),
        services: z.array(z.string()).optional().describe("Preferred streaming services, for example Netflix or Prime Video"),
        language: z.string().optional().describe("Original language code such as en, hi, ta, te, ko, or any"),
        runtime: z.string().optional().describe("Maximum runtime in minutes, or any"),
        minRating: z.string().optional().describe("Minimum TMDB rating from 0 to 9, defaults to 6.7"),
        maxResults: z.string().optional().describe("Number of recommendations to return, from 3 to 10. Defaults to 6"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ likedTitles, dislikedTitles, country, services, language, runtime, minRating, maxResults }) => {
      const result = await recommendFromTasteProfile(env, {
        likedTitles,
        dislikedTitles,
        country,
        services,
        language,
        runtime,
        minRating,
        maxResults,
      });
      return textResult(tasteProfileSummary(result));
    },
  );

  server.registerTool(
    "build_person_watch_path",
    {
      description: "Build a watch path for an actor, director, or crew member with best-rated, available-now, recent, and starter picks",
      inputSchema: {
        name: z.string().describe("Actor, director, writer, or crew member name"),
        country: z.string().optional().describe("ISO 3166-1 country code for watch-provider availability, defaults to IN"),
        services: z.array(z.string()).optional().describe("Preferred streaming services, for example Netflix or Prime Video"),
        maxTitles: z.string().optional().describe("Number of watch-path entries to return, from 3 to 8. Defaults to 5"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ name, country, services, maxTitles }) => {
      const result = await buildPersonWatchPath(env, {
        name,
        country,
        services,
        maxTitles,
      });
      return textResult(personWatchPathSummary(result));
    },
  );

  server.registerTool(
    "search_movies",
    {
      description: "Search for movies by title or keywords",
      inputSchema: {
        query: z.string().describe("Search query for movie titles"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ query }) => {
      const data = await fetchFromTMDB<TMDBResponse>(env, "/search/movie", { query });
      return textResult(`Found ${data.results.length} movies:\n\n${movieList(data.results)}`);
    },
  );

  server.registerTool(
    "get_recommendations",
    {
      description: "Get movie recommendations based on a movie ID",
      inputSchema: {
        movieId: z.string().describe("TMDB movie ID to get recommendations for"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ movieId }) => {
      const data = await fetchFromTMDB<TMDBResponse>(env, `/movie/${movieId}/recommendations`);
      return textResult(`Top 5 recommendations:\n\n${movieList(data.results, 5)}`);
    },
  );

  server.registerTool(
    "get_trending",
    {
      description: "Get trending movies for a time window",
      inputSchema: {
        timeWindow: z.enum(["day", "week"]).describe("Time window for trending movies"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ timeWindow }) => {
      const data = await fetchFromTMDB<TMDBResponse>(env, `/trending/movie/${timeWindow}`);
      return textResult(`Trending movies for the ${timeWindow}:\n\n${movieList(data.results)}`);
    },
  );

  server.registerTool(
    "get_weekly_trending_by_language",
    {
      description: "Get weekly trending movies grouped into English, Hindi, and Telugu by TMDB original_language",
      inputSchema: {},
      annotations: READ_ONLY_TOOL,
    },
    async () => {
      const result = await getWeeklyTrendingByLanguage(env);
      return textResult(weeklyTrendingByLanguageList(result));
    },
  );

  server.registerTool(
    "search_by_genre",
    {
      description: "Search for movies by genre",
      inputSchema: {
        genre: z.string().describe("Genre name, for example action, comedy, or horror"),
        year: z.string().optional().describe("Optional release year filter"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ genre, year }) => {
      const genreMatch = await genreIdFor(env, genre);
      if (!genreMatch.id) {
        return textResult(
          `Genre "${genre}" not found. Available genres: ${genreMatch.available.join(", ")}`,
          true,
        );
      }

      const params: Record<string, string> = {
        with_genres: String(genreMatch.id),
        sort_by: "popularity.desc",
      };
      if (year) params.year = year;

      const data = await fetchFromTMDB<TMDBResponse>(env, "/discover/movie", params);
      const yearFilter = year ? ` from ${year}` : "";
      return textResult(
        `Found ${Math.min(data.results.length, 10)} ${genre} movies${yearFilter}:\n\n${movieList(data.results)}`,
      );
    },
  );

  server.registerTool(
    "advanced_search",
    {
      description: "Advanced movie search with multiple filters",
      inputSchema: {
        genre: z.string().optional().describe("Genre name"),
        year: z.string().optional().describe("Release year"),
        minRating: z.string().optional().describe("Minimum rating from 0 to 10"),
        sortBy: z
          .enum([
            "popularity.desc",
            "popularity.asc",
            "vote_average.desc",
            "vote_average.asc",
            "release_date.desc",
            "release_date.asc",
          ])
          .optional()
          .describe("Sort order, defaults to popularity.desc"),
        language: z.string().optional().describe("Original language code, for example en, hi, or te"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ genre, year, minRating, sortBy, language }) => {
      const params: Record<string, string> = {
        sort_by: sortBy || "popularity.desc",
      };

      if (genre) {
        const genreMatch = await genreIdFor(env, genre);
        if (!genreMatch.id) {
          return textResult(
            `Genre "${genre}" not found. Available genres: ${genreMatch.available.join(", ")}`,
            true,
          );
        }
        params.with_genres = String(genreMatch.id);
      }

      if (year) params.year = year;
      if (minRating) params["vote_average.gte"] = minRating;
      if (language) params.with_original_language = language;

      const data = await fetchFromTMDB<TMDBResponse>(env, "/discover/movie", params);
      const filters = [
        genre ? `Genre: ${genre}` : null,
        year ? `Year: ${year}` : null,
        minRating ? `Min Rating: ${minRating}/10` : null,
        language ? `Language: ${language}` : null,
      ].filter(Boolean);
      const filterText = filters.length > 0 ? ` (${filters.join(", ")})` : "";
      return textResult(
        `Found ${Math.min(data.results.length, 10)} movies${filterText}:\n\n${movieList(data.results)}`,
      );
    },
  );

  server.registerTool(
    "search_person",
    {
      description: "Search for actors, directors, or other people in the film industry",
      inputSchema: {
        name: z.string().describe("Person's name to search for"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ name }) => {
      const data = await fetchFromTMDB<PersonResponse>(env, "/search/person", { query: name });
      const results = data.results
        .slice(0, 5)
        .map((person) => {
          const knownFor = person.known_for
            .slice(0, 3)
            .map((movie) => `${movie.title} (${yearFrom(movie.release_date)})`)
            .join(", ");

          return `${person.name} - ID: ${person.id}\n` +
            `Department: ${person.known_for_department}\n` +
            `Known for: ${knownFor}\n` +
            `Popularity: ${person.popularity.toFixed(1)}`;
        })
        .join("\n---\n");

      return textResult(`Found ${Math.min(data.results.length, 5)} people matching "${name}":\n\n${results}`);
    },
  );

  server.registerTool(
    "search_by_keyword",
    {
      description: "Search for movies by keywords or themes",
      inputSchema: {
        keyword: z.string().describe("Keyword or theme to search for"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ keyword }) => {
      const keywordData = await fetchFromTMDB<KeywordResponse>(env, "/search/keyword", { query: keyword });
      if (keywordData.results.length === 0) {
        return textResult(`No keywords found matching "${keyword}". Try more general terms.`);
      }

      const keywordId = keywordData.results[0].id;
      const keywordName = keywordData.results[0].name;
      const movieData = await fetchFromTMDB<TMDBResponse>(env, "/discover/movie", {
        with_keywords: String(keywordId),
        sort_by: "popularity.desc",
      });

      return textResult(
        `Found ${Math.min(movieData.results.length, 10)} movies with keyword "${keywordName}":\n\n${movieList(movieData.results)}`,
      );
    },
  );

  server.registerTool(
    "get_movie_details",
    {
      description: "Get full details for a movie including cast, crew, runtime, budget, and reviews",
      inputSchema: {
        movieId: z.string().describe("TMDB movie ID"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ movieId }) => {
      const movie = await fetchFromTMDB<Movie>(env, `/movie/${movieId}`, {
        append_to_response: "credits,reviews",
      });
      const director = movie.credits?.crew?.find((person) => person.job === "Director")?.name;
      const writers = movie.credits?.crew
        ?.filter((person) => ["Screenplay", "Writer", "Story"].includes(person.job))
        .slice(0, 3)
        .map((person) => person.name)
        .join(", ");
      const cast = movie.credits?.cast
        ?.slice(0, 8)
        .map((actor) => `${actor.name} as ${actor.character}`)
        .join("\n  ");
      const topReview = movie.reviews?.results?.[0];

      const lines = [
        `**${movie.title}** (${yearFrom(movie.release_date)})`,
        `ID: ${movie.id}`,
        `Rating: ${movie.vote_average}/10`,
        movie.runtime ? `Runtime: ${movie.runtime} min` : null,
        movie.genres?.length ? `Genres: ${movie.genres.map((genre) => genre.name).join(", ")}` : null,
        `\nOverview: ${movie.overview}`,
        director ? `\nDirector: ${director}` : null,
        writers ? `Writers: ${writers}` : null,
        cast ? `\nCast:\n  ${cast}` : null,
        topReview ? `\nTop Review by ${topReview.author}:\n"${topReview.content.slice(0, 300)}..."` : null,
      ].filter(Boolean).join("\n");

      return textResult(lines);
    },
  );

  server.registerTool(
    "compare_movies",
    {
      description: "Compare 2 to 5 movies side by side with ratings, runtime, genres, cast, director, watch providers, and best-fit notes",
      inputSchema: {
        movieIds: z.array(z.string()).min(2).max(5).describe("TMDB movie IDs to compare"),
        country: z.string().optional().describe("ISO 3166-1 country code for watch-provider availability, defaults to IN"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ movieIds, country }) => {
      const resolvedCountry = (country || "IN").toUpperCase();
      const comparisons = await Promise.all(movieIds.map(async (movieId) => {
        const [movie, providersResult] = await Promise.all([
          fetchFromTMDB<Movie>(env, `/movie/${movieId}`, {
            append_to_response: "credits,reviews",
          }),
          fetchFromTMDB<WatchProvidersResponse>(env, `/movie/${movieId}/watch/providers`).catch(() => undefined),
        ]);

        return {
          movie,
          providers: providersResult?.results?.[resolvedCountry],
        };
      }));

      return textResult(renderMovieComparison(comparisons, resolvedCountry));
    },
  );

  server.registerTool(
    "get_watch_providers",
    {
      description: "Get streaming, rental, and purchase availability for a movie by country",
      inputSchema: {
        movieId: z.string().describe("TMDB movie ID"),
        country: z.string().optional().describe("ISO 3166-1 country code, defaults to IN"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ movieId, country }) => {
      const resolvedCountry = country || "IN";
      const data = await fetchFromTMDB<WatchProvidersResponse>(env, `/movie/${movieId}/watch/providers`);
      const countryData = data.results[resolvedCountry];

      if (!countryData) {
        const availableCountries = Object.keys(data.results).slice(0, 10).join(", ");
        return textResult(
          `No watch providers found for ${resolvedCountry}. Available countries include: ${availableCountries}`,
        );
      }

      const lines = [`Watch providers for this movie in ${resolvedCountry}:`];
      if (countryData.flatrate?.length) {
        lines.push("\nStreaming (subscription):");
        countryData.flatrate.forEach((provider) => lines.push(`  - ${provider.provider_name}`));
      }
      if (countryData.rent?.length) {
        lines.push("\nAvailable to rent:");
        countryData.rent.forEach((provider) => lines.push(`  - ${provider.provider_name}`));
      }
      if (countryData.buy?.length) {
        lines.push("\nAvailable to buy:");
        countryData.buy.forEach((provider) => lines.push(`  - ${provider.provider_name}`));
      }
      if (countryData.link) {
        lines.push(`\nFull details: ${countryData.link}`);
      }

      return textResult(lines.join("\n"));
    },
  );

  server.registerTool(
    "find_where_to_watch",
    {
      description: "Find where one or more movie titles are available by searching titles, matching TMDB movies, and checking streaming, rental, and purchase providers",
      inputSchema: {
        titles: z.array(z.string()).min(1).max(5).describe("Movie titles to search and check for availability"),
        country: z.string().optional().describe("ISO 3166-1 country code for provider availability, defaults to IN"),
        services: z.array(z.string()).optional().describe("Preferred services to highlight, for example Netflix, Prime Video, or Disney Plus"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ titles, country, services }) => {
      const resolvedCountry = (country || "IN").toUpperCase();
      const requestedServices = (services || []).map((service) => service.trim()).filter(Boolean);
      const matches = await Promise.all(titles.map(async (query) => {
        const search = await fetchFromTMDB<TMDBResponse>(env, "/search/movie", { query });
        const movie = search.results[0];
        if (!movie) return { query };

        const providersResult = await fetchFromTMDB<WatchProvidersResponse>(
          env,
          `/movie/${movie.id}/watch/providers`,
        ).catch(() => undefined);

        return {
          query,
          movie,
          providers: providersResult?.results?.[resolvedCountry],
        };
      }));

      return textResult(renderWhereToWatch(matches, resolvedCountry, requestedServices));
    },
  );

  server.registerTool(
    "search_tv_shows",
    {
      description: "Search for TV shows and series by title",
      inputSchema: {
        query: z.string().describe("Search query for TV show titles"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ query }) => {
      const data = await fetchFromTMDB<TVResponse>(env, "/search/tv", { query });
      return textResult(
        `Found ${Math.min(data.results.length, 10)} TV shows matching "${query}":\n\n${tvList(data.results)}`,
      );
    },
  );

  server.registerTool(
    "get_trending_tv",
    {
      description: "Get trending TV shows for a time window",
      inputSchema: {
        timeWindow: z.enum(["day", "week"]).describe("Time window for trending TV shows"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ timeWindow }) => {
      const data = await fetchFromTMDB<TVResponse>(env, `/trending/tv/${timeWindow}`);
      return textResult(`Trending TV shows for the ${timeWindow}:\n\n${tvList(data.results)}`);
    },
  );

  server.registerTool(
    "get_person_details",
    {
      description: "Get full biography and filmography for an actor or director",
      inputSchema: {
        personId: z.string().describe("TMDB person ID from search_person results"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ personId }) => {
      const person = await fetchFromTMDB<PersonDetails>(env, `/person/${personId}`, {
        append_to_response: "movie_credits,tv_credits",
      });

      const topMovies = person.movie_credits?.cast
        ?.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
        .slice(0, 10)
        .map((movie) =>
          `  - ${movie.title} (${yearFrom(movie.release_date)}) as ${movie.character} - ${(movie.vote_average || 0).toFixed(1)}/10`
        )
        .join("\n");
      const directedMovies = person.movie_credits?.crew
        ?.filter((movie) => movie.job === "Director")
        .sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""))
        .slice(0, 5)
        .map((movie) => `  - ${movie.title} (${yearFrom(movie.release_date)})`)
        .join("\n");
      const topTV = person.tv_credits?.cast
        ?.slice(0, 5)
        .map((show) => `  - ${show.name} (${yearFrom(show.first_air_date)}) as ${show.character}`)
        .join("\n");

      const lines = [
        `**${person.name}**`,
        `ID: ${person.id}`,
        `Department: ${person.known_for_department}`,
        person.birthday ? `Born: ${person.birthday}${person.place_of_birth ? ` in ${person.place_of_birth}` : ""}` : null,
        person.biography ? `\nBiography: ${person.biography.slice(0, 500)}${person.biography.length > 500 ? "..." : ""}` : null,
        topMovies ? `\nTop Movies (by rating):\n${topMovies}` : null,
        directedMovies ? `\nDirected:\n${directedMovies}` : null,
        topTV ? `\nTV Shows:\n${topTV}` : null,
      ].filter(Boolean).join("\n");

      return textResult(lines);
    },
  );

  server.registerTool(
    "get_similar_movies",
    {
      description: "Get movies similar to a given movie using TMDB's similarity algorithm",
      inputSchema: {
        movieId: z.string().describe("TMDB movie ID"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ movieId }) => {
      const data = await fetchFromTMDB<TMDBResponse>(env, `/movie/${movieId}/similar`);
      return textResult(`Similar movies:\n\n${movieList(data.results)}`);
    },
  );

  server.registerTool(
    "get_now_playing",
    {
      description: "Get movies currently playing in theaters",
      inputSchema: {
        region: z.string().optional().describe("ISO 3166-1 country code, defaults to IN"),
        page: z.number().optional().describe("Page number for pagination, defaults to 1"),
      },
      annotations: READ_ONLY_TOOL,
    },
    async ({ region, page }) => {
      const data = await fetchFromTMDB<TMDBResponse>(env, "/movie/now_playing", {
        region: region || "IN",
        page: String(page || 1),
      });
      const dateRange = data.dates ? ` (from ${data.dates.minimum} to ${data.dates.maximum})` : "";
      return textResult(`Movies now playing in theaters${dateRange}:\n\n${movieList(data.results, 15)}`);
    },
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(renderConciergeApp(), {
        headers: {
          ...securityHeaders(),
          "content-type": "text/html; charset=utf-8",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        name: "tmdb-cloudflare",
        mcpEndpoint: "/mcp",
        app: "weekend-watch-concierge",
        hasAccessToken: Boolean(env.ACCESS_TOKEN),
        hasTMDBKey: Boolean(env.TMDB_API_KEY),
      }, { headers: securityHeaders() });
    }

    if (request.method === "OPTIONS" && (url.pathname === "/api/concierge" || url.pathname === "/api/watch-party" || url.pathname === "/api/weekly-trending-languages")) {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "authorization, content-type",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/api/weekly-trending-languages") {
      if (!authorized(request, env)) {
        return unauthorizedResponse();
      }

      try {
        const result = await getWeeklyTrendingByLanguage(env);
        return Response.json(result, {
          headers: {
            ...securityHeaders(),
            "access-control-allow-origin": "*",
          },
        });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unable to load weekly trends." },
          {
            status: 500,
            headers: {
              ...securityHeaders(),
              "access-control-allow-origin": "*",
            },
          },
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/api/concierge") {
      if (!authorized(request, env)) {
        return unauthorizedResponse();
      }

      try {
        const input = await request.json().catch(() => ({}));
        const result = await createWeekendConcierge(env, input as Record<string, unknown>);
        return Response.json(result, {
          headers: {
            ...securityHeaders(),
            "access-control-allow-origin": "*",
          },
        });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unable to generate concierge picks." },
          {
            status: 500,
            headers: {
              ...securityHeaders(),
              "access-control-allow-origin": "*",
            },
          },
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/api/watch-party") {
      if (!authorized(request, env)) {
        return unauthorizedResponse();
      }

      try {
        const input = await request.json().catch(() => ({}));
        const result = await createWatchPartyPlanner(env, input as Record<string, unknown>);
        return Response.json(result, {
          headers: {
            ...securityHeaders(),
            "access-control-allow-origin": "*",
          },
        });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unable to generate watch party plan." },
          {
            status: 500,
            headers: {
              ...securityHeaders(),
              "access-control-allow-origin": "*",
            },
          },
        );
      }
    }

    if (url.pathname === "/mcp" && !authorized(request, env)) {
      return unauthorizedResponse();
    }

    const server = createTMDBServer(env);
    return createMcpHandler(server, { route: "/mcp" })(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
