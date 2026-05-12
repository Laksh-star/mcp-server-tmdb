interface Env {
  TMDB_API_KEY?: string;
  TMDB_BASE_URL?: string;
}

interface PersonWatchPathInput {
  name?: string;
  country?: string;
  services?: string[];
  maxTitles?: string;
}

interface PersonSearchResponse {
  results: Array<{
    id: number;
    name: string;
    known_for_department?: string;
  }>;
}

interface PersonDetails {
  id: number;
  name: string;
  known_for_department?: string;
  biography?: string;
  movie_credits?: {
    cast: CreditMovie[];
    crew: CreditMovie[];
  };
}

interface CreditMovie {
  id: number;
  title: string;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  character?: string;
  job?: string;
}

interface MovieDetails extends CreditMovie {
  runtime?: number;
  overview: string;
  genres?: Array<{ id: number; name: string }>;
  "watch/providers"?: WatchProvidersResponse;
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

export interface PersonWatchPathPick {
  role: string;
  id: number;
  title: string;
  year: string;
  rating: number;
  runtime?: number;
  genres: string[];
  overview: string;
  credit: string;
  providers: {
    streaming: string[];
    rent: string[];
    buy: string[];
    link?: string;
  };
  reason: string;
}

export interface PersonWatchPathResult {
  generatedAt: string;
  personId: number;
  name: string;
  department: string;
  country: string;
  picks: PersonWatchPathPick[];
  decision: string[];
  notes: string[];
}

function normalizeCountry(country?: string): string {
  return (country || "IN").trim().slice(0, 2).toUpperCase() || "IN";
}

function parseMaxTitles(maxTitles?: string): number {
  const parsed = Number(maxTitles || "5");
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(8, Math.max(3, Math.round(parsed)));
}

function yearFrom(date?: string): string {
  return date?.split("-")[0] || "unknown";
}

function providerNames(providers?: WatchProvider[]): string[] {
  return providers?.map((provider) => provider.provider_name).filter(Boolean) || [];
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

function uniqueCredits(person: PersonDetails): CreditMovie[] {
  const seen = new Map<number, CreditMovie>();
  const credits = [
    ...(person.movie_credits?.cast || []),
    ...(person.movie_credits?.crew || []),
  ];
  for (const credit of credits) {
    const existing = seen.get(credit.id);
    if (!existing || (credit.vote_average || 0) > (existing.vote_average || 0)) {
      seen.set(credit.id, credit);
    }
  }
  return Array.from(seen.values()).filter((credit) => credit.title && credit.release_date);
}

function creditLabel(movie: MovieDetails): string {
  if (movie.character) return `Actor: ${movie.character}`;
  if (movie.job) return movie.job;
  return "Credit";
}

function toPick(
  role: string,
  movie: MovieDetails,
  country: string,
  reason: string,
): PersonWatchPathPick {
  const countryProviders = movie["watch/providers"]?.results?.[country];
  return {
    role,
    id: movie.id,
    title: movie.title,
    year: yearFrom(movie.release_date),
    rating: movie.vote_average || 0,
    runtime: movie.runtime,
    genres: movie.genres?.map((genre) => genre.name) || [],
    overview: movie.overview || "",
    credit: creditLabel(movie),
    providers: {
      streaming: providerNames(countryProviders?.flatrate),
      rent: providerNames(countryProviders?.rent),
      buy: providerNames(countryProviders?.buy),
      link: countryProviders?.link,
    },
    reason,
  };
}

function releaseTimestamp(movie: CreditMovie): number {
  const timestamp = movie.release_date ? Date.parse(movie.release_date) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function scoreAvailable(movie: MovieDetails, requestedServices: string[], country: string): number {
  const providers = movie["watch/providers"]?.results?.[country];
  const allProviders = [
    ...providerNames(providers?.flatrate),
    ...providerNames(providers?.rent),
    ...providerNames(providers?.buy),
  ];
  return serviceMatchScore(allProviders, requestedServices) * 20 +
    (providerNames(providers?.flatrate).length > 0 ? 10 : 0) +
    (movie.vote_average || 0);
}

function addUniquePick(picks: PersonWatchPathPick[], pick: PersonWatchPathPick | undefined, maxTitles: number) {
  if (!pick || picks.some((item) => item.id === pick.id) || picks.length >= maxTitles) return;
  picks.push(pick);
}

export async function buildPersonWatchPath(
  env: Env,
  rawInput: PersonWatchPathInput,
): Promise<PersonWatchPathResult> {
  const name = String(rawInput.name || "").trim();
  if (!name) {
    throw new Error("build_person_watch_path requires a person name.");
  }

  const country = normalizeCountry(rawInput.country);
  const maxTitles = parseMaxTitles(rawInput.maxTitles);
  const requestedServices = (rawInput.services || []).map((service) => service.trim()).filter(Boolean);
  const search = await fetchFromTMDB<PersonSearchResponse>(env, "/search/person", { query: name });
  const person = search.results[0];
  if (!person) {
    throw new Error(`No TMDB person found for "${name}".`);
  }

  const details = await fetchFromTMDB<PersonDetails>(env, `/person/${person.id}`, {
    append_to_response: "movie_credits",
  });
  const credits = uniqueCredits(details)
    .filter((credit) => (credit.vote_count || 0) >= 30)
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, 18);

  const detailedResults = await Promise.allSettled(
    credits.map((credit) =>
      fetchFromTMDB<MovieDetails>(env, `/movie/${credit.id}`, {
        append_to_response: "watch/providers",
      }).then((movie): MovieDetails => ({
        ...movie,
        character: credit.character,
        job: credit.job,
      })),
    ),
  );
  const movies = detailedResults
    .filter((result): result is PromiseFulfilledResult<MovieDetails> => result.status === "fulfilled")
    .map((result) => result.value);

  const byRating = [...movies].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  const recent = [...movies].sort((a, b) => releaseTimestamp(b) - releaseTimestamp(a));
  const popularOlder = [...movies]
    .filter((movie) => Number(yearFrom(movie.release_date)) < 2015)
    .sort((a, b) => ((b.vote_average || 0) + Math.min(b.popularity || 0, 100) / 20) - ((a.vote_average || 0) + Math.min(a.popularity || 0, 100) / 20));
  const available = [...movies].sort((a, b) => scoreAvailable(b, requestedServices, country) - scoreAvailable(a, requestedServices, country));

  const picks: PersonWatchPathPick[] = [];
  addUniquePick(picks, byRating[0] && toPick("Best-rated pick", byRating[0], country, "Highest-rated credible movie credit in this scan."), maxTitles);
  addUniquePick(picks, available[0] && toPick("Available-now pick", available[0], country, requestedServices.length > 0 ? "Best provider fit among scanned credits." : "Strongest watch-provider availability in the selected country."), maxTitles);
  addUniquePick(picks, recent[0] && toPick("Recent pick", recent[0], country, "Recent credit with enough TMDB voting signal."), maxTitles);
  addUniquePick(picks, popularOlder[0] && toPick("Starter classic", popularOlder[0], country, "Older, high-signal credit that works as a context-setting starter."), maxTitles);
  for (const movie of byRating) {
    addUniquePick(picks, toPick("Also worth watching", movie, country, "Strong supporting entry in the watch path."), maxTitles);
  }

  const decision = picks.length > 0
    ? [
        `Start with ${picks[0].title}; it is the strongest entry point from the scanned credits.`,
        picks.find((pick) => pick.role === "Available-now pick")
          ? `Use ${picks.find((pick) => pick.role === "Available-now pick")?.title} if watch-provider availability matters most.`
          : undefined,
      ].filter((line): line is string => Boolean(line))
    : ["No eligible movie credits were found for this person."];

  const notes = [
    `Scanned ${movies.length} movie credit${movies.length === 1 ? "" : "s"} with enough TMDB vote signal.`,
  ];
  if (detailedResults.some((result) => result.status === "rejected")) {
    notes.push("Some movie details were skipped because TMDB detail requests failed.");
  }

  return {
    generatedAt: new Date().toISOString(),
    personId: details.id,
    name: details.name,
    department: details.known_for_department || person.known_for_department || "unknown",
    country,
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

function providerLine(pick: PersonWatchPathPick): string {
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

export function personWatchPathSummary(result: PersonWatchPathResult): string {
  const picks = result.picks
    .map((pick, index) =>
      `${index + 1}. ${pick.role}: ${pick.title} (${pick.year}) - ID: ${pick.id}\n` +
      `Credit: ${pick.credit}\n` +
      `Rating: ${pick.rating.toFixed(1)}/10 | Runtime: ${formatRuntime(pick.runtime)}\n` +
      `${pick.genres.length > 0 ? `Genres: ${pick.genres.slice(0, 4).join(", ")}\n` : ""}` +
      `${providerLine(pick)}\n` +
      `Why: ${pick.reason}\n` +
      `Overview: ${pick.overview}`,
    )
    .join("\n---\n");

  const notes = result.notes.length > 0 ? `\n\nNotes:\n${result.notes.map((note) => `- ${note}`).join("\n")}` : "";

  return `Person Watch Path\n` +
    `Person: ${result.name} - ID: ${result.personId}\n` +
    `Department: ${result.department}\n` +
    `Country: ${result.country}\n\n` +
    `Decision:\n${result.decision.map((line) => `- ${line}`).join("\n")}\n\n` +
    `${picks || "No watch-path picks found."}` +
    notes;
}
