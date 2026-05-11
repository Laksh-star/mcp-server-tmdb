interface Env {
  TMDB_API_KEY?: string;
  TMDB_BASE_URL?: string;
}

interface FranchiseInput {
  query?: string;
  country?: string;
  maxMovies?: string;
}

interface CollectionSearchResponse {
  results: Array<{
    id: number;
    name: string;
    overview?: string;
  }>;
}

interface MovieSearchResponse {
  results: Array<{
    id: number;
    title: string;
    release_date?: string;
  }>;
}

interface CollectionDetails {
  id: number;
  name: string;
  overview?: string;
  parts: CollectionPart[];
}

interface CollectionPart {
  id: number;
  title: string;
  release_date?: string;
  vote_average?: number;
  overview?: string;
  poster_path?: string;
}

interface MovieDetails extends CollectionPart {
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
  belongs_to_collection?: {
    id: number;
    name: string;
  } | null;
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

export interface FranchiseMovie {
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
  note: string;
}

export interface FranchiseGuideResult {
  generatedAt: string;
  query: string;
  country: string;
  collectionId: number;
  collectionName: string;
  overview?: string;
  totalRuntimeMinutes?: number;
  releaseOrder: FranchiseMovie[];
  suggestedOrder: FranchiseMovie[];
  decision: string[];
  notes: string[];
}

function normalizeCountry(country?: string): string {
  return (country || "IN").trim().slice(0, 2).toUpperCase() || "IN";
}

function parseMaxMovies(maxMovies?: string): number {
  const parsed = Number(maxMovies || "12");
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(20, Math.max(2, Math.round(parsed)));
}

function yearFrom(date?: string): string {
  return date?.split("-")[0] || "unknown";
}

function providerNames(providers?: WatchProvider[]): string[] {
  return providers?.map((provider) => provider.provider_name).filter(Boolean) || [];
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

async function resolveCollection(env: Env, query: string): Promise<CollectionDetails> {
  const collections = await fetchFromTMDB<CollectionSearchResponse>(env, "/search/collection", {
    query,
  });
  const directMatch = collections.results[0];
  if (directMatch) {
    return fetchFromTMDB<CollectionDetails>(env, `/collection/${directMatch.id}`);
  }

  const movies = await fetchFromTMDB<MovieSearchResponse>(env, "/search/movie", { query });
  for (const movie of movies.results.slice(0, 5)) {
    const details = await fetchFromTMDB<MovieDetails>(env, `/movie/${movie.id}`);
    if (details.belongs_to_collection?.id) {
      return fetchFromTMDB<CollectionDetails>(env, `/collection/${details.belongs_to_collection.id}`);
    }
  }

  throw new Error(`No TMDB collection found for "${query}". Try a franchise title such as The Matrix, Dune, or Mission Impossible.`);
}

function releaseTimestamp(movie: CollectionPart): number {
  const timestamp = movie.release_date ? Date.parse(movie.release_date) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function movieNote(movie: MovieDetails, providers: WatchProviderResult | undefined, firstReleaseId: number): string {
  if (movie.id === firstReleaseId) return "Start here for release-order context.";
  if (providerNames(providers?.flatrate).length > 0 && (movie.vote_average || 0) >= 7) {
    return "Strong provider-aware follow-up.";
  }
  if ((movie.vote_average || 0) >= 7.5) return "High-rated franchise entry.";
  if (movie.runtime && movie.runtime > 160) return "Longer entry; plan for a full evening.";
  return "Continue here if you want the complete franchise arc.";
}

function toFranchiseMovie(
  movie: MovieDetails,
  country: string,
  firstReleaseId: number,
): FranchiseMovie {
  const countryProviders = movie["watch/providers"]?.results?.[country];
  return {
    id: movie.id,
    title: movie.title,
    year: yearFrom(movie.release_date),
    rating: movie.vote_average || 0,
    runtime: movie.runtime,
    genres: movie.genres?.map((genre) => genre.name) || [],
    overview: movie.overview || "",
    providers: {
      streaming: providerNames(countryProviders?.flatrate),
      rent: providerNames(countryProviders?.rent),
      buy: providerNames(countryProviders?.buy),
      link: countryProviders?.link,
    },
    note: movieNote(movie, countryProviders, firstReleaseId),
  };
}

function suggestedOrderFor(movies: FranchiseMovie[]): FranchiseMovie[] {
  if (movies.length <= 4) return movies;
  const first = movies[0];
  const rest = movies.slice(1);
  return [
    first,
    ...rest.sort((a, b) => {
      const aStreaming = a.providers.streaming.length > 0 ? 1 : 0;
      const bStreaming = b.providers.streaming.length > 0 ? 1 : 0;
      if (aStreaming !== bStreaming) return bStreaming - aStreaming;
      return b.rating - a.rating;
    }),
  ];
}

export async function buildFranchiseWatchOrder(
  env: Env,
  rawInput: FranchiseInput,
): Promise<FranchiseGuideResult> {
  const query = String(rawInput.query || "").trim();
  if (!query) {
    throw new Error("build_franchise_watch_order requires a franchise query.");
  }

  const country = normalizeCountry(rawInput.country);
  const maxMovies = parseMaxMovies(rawInput.maxMovies);
  const collection = await resolveCollection(env, query);
  const releaseParts = [...collection.parts]
    .sort((a, b) => releaseTimestamp(a) - releaseTimestamp(b))
    .slice(0, maxMovies);
  const firstReleaseId = releaseParts[0]?.id;

  const detailedResults = await Promise.allSettled(
    releaseParts.map((movie) =>
      fetchFromTMDB<MovieDetails>(env, `/movie/${movie.id}`, {
        append_to_response: "watch/providers",
      }),
    ),
  );
  const detailed = detailedResults
    .filter((result): result is PromiseFulfilledResult<MovieDetails> => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((a, b) => releaseTimestamp(a) - releaseTimestamp(b));

  const releaseOrder = detailed.map((movie) => toFranchiseMovie(movie, country, firstReleaseId));
  const suggestedOrder = suggestedOrderFor([...releaseOrder]);
  const totalRuntime = releaseOrder.reduce((sum, movie) => sum + (movie.runtime || 0), 0);
  const streamingMatches = releaseOrder.filter((movie) => movie.providers.streaming.length > 0);

  const decision = [
    releaseOrder[0] ? `Start with ${releaseOrder[0].title}; release order is the clearest default for this franchise.` : undefined,
    suggestedOrder[1] && suggestedOrder[1].id !== releaseOrder[1]?.id
      ? `After the opener, prioritize ${suggestedOrder[1].title} if availability and rating matter more than strict release order.`
      : undefined,
    streamingMatches.length > 0
      ? `${streamingMatches.length} of ${releaseOrder.length} entries have subscription streaming data for ${country}.`
      : `TMDB did not return subscription streaming providers for these entries in ${country}.`,
  ].filter((line): line is string => Boolean(line));

  const notes = [
    "Suggested order keeps the first released film first, then favors streaming availability and stronger TMDB ratings.",
  ];
  if (detailed.length < releaseParts.length) {
    notes.push("Some collection entries were skipped because TMDB detail requests failed.");
  }
  if (collection.parts.length > releaseParts.length) {
    notes.push(`Limited to ${releaseParts.length} of ${collection.parts.length} collection entries.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    query,
    country,
    collectionId: collection.id,
    collectionName: collection.name,
    overview: collection.overview,
    totalRuntimeMinutes: totalRuntime || undefined,
    releaseOrder,
    suggestedOrder,
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

function providerLine(movie: FranchiseMovie): string {
  if (movie.providers.streaming.length > 0) {
    return `Streaming: ${movie.providers.streaming.slice(0, 4).join(", ")}`;
  }
  if (movie.providers.rent.length > 0) {
    return `Rent: ${movie.providers.rent.slice(0, 4).join(", ")}`;
  }
  if (movie.providers.buy.length > 0) {
    return `Buy: ${movie.providers.buy.slice(0, 4).join(", ")}`;
  }
  return "Availability: no providers found";
}

function renderMovieLine(movie: FranchiseMovie, index: number): string {
  return `${index + 1}. ${movie.title} (${movie.year}) - ID: ${movie.id}\n` +
    `Rating: ${movie.rating.toFixed(1)}/10 | Runtime: ${formatRuntime(movie.runtime)}\n` +
    `${providerLine(movie)}\n` +
    `Note: ${movie.note}`;
}

export function franchiseGuideSummary(result: FranchiseGuideResult): string {
  const releaseOrder = result.releaseOrder.map(renderMovieLine).join("\n---\n");
  const suggestedOrder = result.suggestedOrder
    .map((movie, index) => `${index + 1}. ${movie.title} (${movie.year})`)
    .join("\n");
  const notes = result.notes.length > 0 ? `\n\nNotes:\n${result.notes.map((note) => `- ${note}`).join("\n")}` : "";

  return `Franchise Watch Guide\n` +
    `Query: ${result.query}\n` +
    `Collection: ${result.collectionName} - ID: ${result.collectionId}\n` +
    `Country: ${result.country}\n` +
    `Total runtime: ${formatRuntime(result.totalRuntimeMinutes)}\n\n` +
    `Decision:\n${result.decision.map((line) => `- ${line}`).join("\n")}\n\n` +
    `Release order:\n${releaseOrder || "No collection entries found."}\n\n` +
    `Suggested order:\n${suggestedOrder || "No suggested order available."}` +
    notes;
}
