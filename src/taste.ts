interface Env {
  TMDB_API_KEY?: string;
  TMDB_BASE_URL?: string;
}

interface TasteProfileInput {
  likedTitles?: string[];
  dislikedTitles?: string[];
  country?: string;
  services?: string[];
  language?: string;
  runtime?: string;
  minRating?: string;
  maxResults?: string;
}

interface MovieSummary {
  id: number;
  title: string;
  release_date?: string;
  original_language?: string;
  vote_average: number;
  vote_count?: number;
  popularity?: number;
  overview: string;
  genre_ids?: number[];
}

interface MovieDetails extends MovieSummary {
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
  "watch/providers"?: WatchProvidersResponse;
}

interface TMDBListResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
}

interface WatchProvider {
  provider_name: string;
}

interface WatchProviderResult {
  link?: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
}

interface WatchProvidersResponse {
  results: Record<string, WatchProviderResult>;
}

export interface TasteProfilePick {
  id: number;
  title: string;
  year: string;
  rating: number;
  runtime?: number;
  genres: string[];
  overview: string;
  providers: {
    streaming: string[];
    rent: string[];
    buy: string[];
    link?: string;
  };
  score: number;
  matchReasons: string[];
  cautions: string[];
}

export interface TasteProfileResult {
  generatedAt: string;
  country: string;
  language: string;
  likedTitles: string[];
  dislikedTitles: string[];
  picks: TasteProfilePick[];
  decision: string[];
  notes: string[];
}

function normalizeCountry(country?: string): string {
  return (country || "IN").trim().slice(0, 2).toUpperCase() || "IN";
}

function normalizeLanguage(language?: string): string {
  return (language || "any").trim().toLowerCase() || "any";
}

function parseRuntime(runtime?: string): number | undefined {
  if (!runtime || runtime === "any") return undefined;
  const parsed = Number(runtime);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseMinRating(minRating?: string): number {
  const parsed = Number(minRating || "6.7");
  if (!Number.isFinite(parsed)) return 6.7;
  return Math.min(9, Math.max(0, parsed));
}

function parseMaxResults(maxResults?: string): number {
  const parsed = Number(maxResults || "6");
  if (!Number.isFinite(parsed)) return 6;
  return Math.min(10, Math.max(3, Math.round(parsed)));
}

function yearFrom(date?: string): string {
  return date?.split("-")[0] || "unknown";
}

function providerNames(providers?: WatchProvider[]): string[] {
  return providers?.map((provider) => provider.provider_name).filter(Boolean) || [];
}

function titleKey(title: string): string {
  return title.trim().toLowerCase().replace(/^the\s+/, "");
}

function serviceMatchScore(available: string[], requested: string[]): number {
  if (requested.length === 0) return 0;
  const normalized = available.map((name) => name.toLowerCase());
  return requested.filter((service) =>
    normalized.some((provider) => provider.includes(service.toLowerCase())),
  ).length;
}

async function fetchFromTMDB<T>(
  env: Env,
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
  if (!env.TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not configured.");
  }

  const baseUrl = env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
  const url = new URL(`${baseUrl}${endpoint}`);
  url.searchParams.set("api_key", env.TMDB_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value !== "") url.searchParams.set(key, value);
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
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("TMDB request failed.");
}

async function resolveMovie(env: Env, title: string): Promise<MovieDetails | undefined> {
  const search = await fetchFromTMDB<TMDBListResponse<MovieSummary>>(env, "/search/movie", { query: title });
  const movie = search.results[0];
  if (!movie) return undefined;
  return fetchFromTMDB<MovieDetails>(env, `/movie/${movie.id}`);
}

async function candidateMoviesFor(env: Env, movieId: number): Promise<MovieSummary[]> {
  const [recommendations, similar] = await Promise.all([
    fetchFromTMDB<TMDBListResponse<MovieSummary>>(env, `/movie/${movieId}/recommendations`).catch(() => undefined),
    fetchFromTMDB<TMDBListResponse<MovieSummary>>(env, `/movie/${movieId}/similar`).catch(() => undefined),
  ]);
  return [
    ...(recommendations?.results || []).slice(0, 10),
    ...(similar?.results || []).slice(0, 8),
  ];
}

function sharedGenreCount(movie: MovieDetails, preferredGenreIds: Set<number>): number {
  const ids = movie.genres?.map((genre) => genre.id) || movie.genre_ids || [];
  return ids.filter((id) => preferredGenreIds.has(id)).length;
}

function dislikedGenreCount(movie: MovieDetails, dislikedGenreIds: Set<number>): number {
  const ids = movie.genres?.map((genre) => genre.id) || movie.genre_ids || [];
  return ids.filter((id) => dislikedGenreIds.has(id)).length;
}

function toPick(
  movie: MovieDetails,
  country: string,
  requestedServices: string[],
  preferredGenreIds: Set<number>,
  dislikedGenreIds: Set<number>,
  maxRuntime: number | undefined,
): TasteProfilePick {
  const countryProviders = movie["watch/providers"]?.results?.[country];
  const streaming = providerNames(countryProviders?.flatrate);
  const rent = providerNames(countryProviders?.rent);
  const buy = providerNames(countryProviders?.buy);
  const availableProviders = [...streaming, ...rent, ...buy];
  const serviceMatches = serviceMatchScore(availableProviders, requestedServices);
  const genreMatches = sharedGenreCount(movie, preferredGenreIds);
  const dislikedGenreMatches = dislikedGenreCount(movie, dislikedGenreIds);

  let score = movie.vote_average * 11;
  score += Math.min(movie.vote_count || 0, 2500) / 180;
  score += Math.min(movie.popularity || 0, 100) / 6;
  score += genreMatches * 10;
  score -= dislikedGenreMatches * 12;
  score += streaming.length > 0 ? 9 : 0;
  score += serviceMatches * 16;
  if (maxRuntime && movie.runtime && movie.runtime <= maxRuntime) score += 7;

  const matchReasons: string[] = [];
  const cautions: string[] = [];
  if (genreMatches > 0) matchReasons.push(`shares ${genreMatches} liked genre${genreMatches > 1 ? "s" : ""}`);
  if (serviceMatches > 0) matchReasons.push(`matches ${serviceMatches} requested service${serviceMatches > 1 ? "s" : ""}`);
  if (streaming.length > 0) matchReasons.push("available on subscription streaming");
  if (movie.vote_average >= 7.5) matchReasons.push(`strong ${movie.vote_average.toFixed(1)}/10 TMDB rating`);
  if (maxRuntime && movie.runtime && movie.runtime <= maxRuntime) matchReasons.push(`fits ${movie.runtime} minute runtime`);
  if (matchReasons.length === 0) matchReasons.push("balanced recommendation from TMDB similarity and ratings");

  if (dislikedGenreMatches > 0) cautions.push(`overlaps ${dislikedGenreMatches} disliked genre${dislikedGenreMatches > 1 ? "s" : ""}`);
  if (streaming.length === 0) cautions.push("no subscription provider found in selected country");
  if (maxRuntime && movie.runtime && movie.runtime > maxRuntime) cautions.push(`runtime is ${movie.runtime} minutes`);

  return {
    id: movie.id,
    title: movie.title,
    year: yearFrom(movie.release_date),
    rating: movie.vote_average,
    runtime: movie.runtime,
    genres: movie.genres?.map((genre) => genre.name) || [],
    overview: movie.overview,
    providers: {
      streaming,
      rent,
      buy,
      link: countryProviders?.link,
    },
    score: Math.round(score),
    matchReasons: matchReasons.slice(0, 4),
    cautions: cautions.slice(0, 3),
  };
}

export async function recommendFromTasteProfile(
  env: Env,
  rawInput: TasteProfileInput,
): Promise<TasteProfileResult> {
  const likedTitles = (rawInput.likedTitles || []).map((title) => title.trim()).filter(Boolean).slice(0, 5);
  if (likedTitles.length === 0) {
    throw new Error("recommend_from_taste_profile requires at least one liked title.");
  }

  const dislikedTitles = (rawInput.dislikedTitles || []).map((title) => title.trim()).filter(Boolean).slice(0, 5);
  const country = normalizeCountry(rawInput.country);
  const language = normalizeLanguage(rawInput.language);
  const maxRuntime = parseRuntime(rawInput.runtime);
  const minRating = parseMinRating(rawInput.minRating);
  const maxResults = parseMaxResults(rawInput.maxResults);
  const requestedServices = (rawInput.services || []).map((service) => service.trim()).filter(Boolean);

  const [likedResolved, dislikedResolved] = await Promise.all([
    Promise.all(likedTitles.map((title) => resolveMovie(env, title).catch(() => undefined))),
    Promise.all(dislikedTitles.map((title) => resolveMovie(env, title).catch(() => undefined))),
  ]);
  const likedMovies = likedResolved.filter((movie): movie is MovieDetails => Boolean(movie));
  const dislikedMovies = dislikedResolved.filter((movie): movie is MovieDetails => Boolean(movie));
  if (likedMovies.length === 0) {
    throw new Error("None of the liked titles could be resolved in TMDB.");
  }

  const preferredGenreIds = new Set(likedMovies.flatMap((movie) => movie.genres?.map((genre) => genre.id) || []));
  const dislikedGenreIds = new Set(dislikedMovies.flatMap((movie) => movie.genres?.map((genre) => genre.id) || []));
  const blockedIds = new Set([...likedMovies, ...dislikedMovies].map((movie) => movie.id));
  const blockedTitles = new Set([...likedTitles, ...dislikedTitles].map(titleKey));

  const candidateGroups = await Promise.all(likedMovies.map((movie) => candidateMoviesFor(env, movie.id)));
  const seen = new Set<number>();
  const candidates = candidateGroups
    .flat()
    .filter((movie) => {
      if (seen.has(movie.id)) return false;
      seen.add(movie.id);
      return !blockedIds.has(movie.id) && !blockedTitles.has(titleKey(movie.title));
    })
    .slice(0, 24);

  const detailedResults = await Promise.allSettled(
    candidates.map((movie) =>
      fetchFromTMDB<MovieDetails>(env, `/movie/${movie.id}`, {
        append_to_response: "watch/providers",
      }),
    ),
  );
  const detailed = detailedResults
    .filter((result): result is PromiseFulfilledResult<MovieDetails> => result.status === "fulfilled")
    .map((result) => result.value);

  const picks = detailed
    .filter((movie) => movie.vote_average >= minRating)
    .filter((movie) => language === "any" || movie.original_language === language)
    .map((movie) => toPick(movie, country, requestedServices, preferredGenreIds, dislikedGenreIds, maxRuntime))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  const decision = picks.length > 0
    ? [
        `Start with ${picks[0].title}; it has the strongest taste-fit score.`,
        picks[1] ? `Use ${picks[1].title} as the safer alternate if availability or mood changes.` : undefined,
        requestedServices.length > 0
          ? "Requested services were boosted when TMDB provider data matched."
          : "Add services to make the recommendations more watch-now oriented.",
      ].filter((line): line is string => Boolean(line))
    : ["No matching recommendations survived the filters."];

  const notes = [
    `Resolved ${likedMovies.length} liked title${likedMovies.length > 1 ? "s" : ""} and ${dislikedMovies.length} disliked title${dislikedMovies.length === 1 ? "" : "s"}.`,
  ];
  if (detailed.length < candidates.length) {
    notes.push("Some recommendation details were skipped because TMDB detail requests failed.");
  }
  if (picks.length === 0) {
    notes.push("Try a lower minimum rating, broader language, or longer runtime.");
  }

  return {
    generatedAt: new Date().toISOString(),
    country,
    language,
    likedTitles,
    dislikedTitles,
    picks,
    decision,
    notes,
  };
}

function formatRuntime(minutes?: number): string {
  if (!minutes) return "runtime unknown";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

function providerLine(pick: TasteProfilePick): string {
  if (pick.providers.streaming.length > 0) {
    return `Streaming: ${pick.providers.streaming.slice(0, 4).join(", ")}`;
  }
  if (pick.providers.rent.length > 0) {
    return `Rent: ${pick.providers.rent.slice(0, 4).join(", ")}`;
  }
  if (pick.providers.buy.length > 0) {
    return `Buy: ${pick.providers.buy.slice(0, 4).join(", ")}`;
  }
  return "Availability: no providers found";
}

export function tasteProfileSummary(result: TasteProfileResult): string {
  const picks = result.picks
    .map((pick, index) =>
      `${index + 1}. ${pick.title} (${pick.year}) - ID: ${pick.id}\n` +
      `Rating: ${pick.rating.toFixed(1)}/10 | Runtime: ${formatRuntime(pick.runtime)} | Score: ${pick.score}\n` +
      `${pick.genres.length > 0 ? `Genres: ${pick.genres.slice(0, 4).join(", ")}\n` : ""}` +
      `${providerLine(pick)}\n` +
      `Why it matches: ${pick.matchReasons.join("; ")}\n` +
      (pick.cautions.length > 0 ? `Watch-outs: ${pick.cautions.join("; ")}\n` : "") +
      `Overview: ${pick.overview}`,
    )
    .join("\n---\n");

  const notes = result.notes.length > 0 ? `\n\nNotes:\n${result.notes.map((note) => `- ${note}`).join("\n")}` : "";

  return `Taste Profile Recommendations\n` +
    `Liked: ${result.likedTitles.join(", ")}\n` +
    `Disliked: ${result.dislikedTitles.length > 0 ? result.dislikedTitles.join(", ") : "none provided"}\n` +
    `Country: ${result.country}\n` +
    `Language: ${result.language}\n\n` +
    `Decision:\n${result.decision.map((line) => `- ${line}`).join("\n")}\n\n` +
    `${picks || "No matching recommendations found."}` +
    notes;
}
