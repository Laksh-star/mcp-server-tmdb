import { buildFranchiseWatchOrder, type FranchiseGuideResult, type FranchiseMovie } from "./franchise.js";

interface Env {
  TMDB_API_KEY?: string;
  TMDB_BASE_URL?: string;
}

interface CollectionGapInput {
  query?: string;
  watchedTitles?: string[];
  country?: string;
  services?: string[];
  maxMovies?: string;
}

export interface CollectionGapMovie extends FranchiseMovie {
  status: "watched" | "missing";
  providerMatch: string[];
  availableNow: boolean;
  gapScore?: number;
}

export interface CollectionGapPlanResult {
  generatedAt: string;
  query: string;
  country: string;
  services: string[];
  watchedTitles: string[];
  collectionId: number;
  collectionName: string;
  completionPercent: number;
  watchedRuntimeMinutes: number;
  remainingRuntimeMinutes: number;
  totalRuntimeMinutes?: number;
  watched: CollectionGapMovie[];
  missing: CollectionGapMovie[];
  completionPath: CollectionGapMovie[];
  releaseOrder: CollectionGapMovie[];
  decision: string[];
  notes: string[];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeServices(services?: string[]): string[] {
  return (services || []).map((service) => service.trim()).filter(Boolean);
}

function normalizeWatchedTitles(watchedTitles?: string[]): string[] {
  return (watchedTitles || []).map((title) => title.trim()).filter(Boolean);
}

function serviceMatches(movie: FranchiseMovie, services: string[]): string[] {
  if (services.length === 0) return [];
  const providers = [
    ...movie.providers.streaming,
    ...movie.providers.rent,
    ...movie.providers.buy,
  ];
  return providers.filter((provider) =>
    services.some((service) => {
      const providerKey = normalize(provider);
      const serviceKey = normalize(service);
      return providerKey.includes(serviceKey) || serviceKey.includes(providerKey);
    }),
  );
}

function watchedMatcher(watchedTitles: string[]) {
  const normalizedTitles = new Set(watchedTitles.map(normalize));
  const ids = new Set(watchedTitles.filter((title) => /^\d+$/.test(title)));
  return (movie: FranchiseMovie) => ids.has(String(movie.id)) || normalizedTitles.has(normalize(movie.title));
}

function toGapMovie(
  movie: FranchiseMovie,
  status: "watched" | "missing",
  services: string[],
): CollectionGapMovie {
  return {
    ...movie,
    status,
    providerMatch: serviceMatches(movie, services),
    availableNow: movie.providers.streaming.length > 0,
  };
}

function scoreMissing(movie: CollectionGapMovie, position: number): number {
  let score = Math.max(0, 100 - position * 3);
  if (movie.rating >= 7.5) score += 20;
  if (movie.rating >= 7) score += 10;
  if (movie.availableNow) score += 15;
  if (movie.providerMatch.length > 0) score += 20;
  if (position === 0) score += 10;
  return score;
}

function runtimeTotal(movies: FranchiseMovie[]): number {
  return movies.reduce((sum, movie) => sum + (movie.runtime || 0), 0);
}

function formatRuntime(minutes: number): string {
  if (!minutes) return "unknown";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

function availabilityLine(movie: CollectionGapMovie): string {
  if (movie.providers.streaming.length > 0) return `Streaming: ${movie.providers.streaming.slice(0, 4).join(", ")}`;
  if (movie.providers.rent.length > 0) return `Rent: ${movie.providers.rent.slice(0, 4).join(", ")}`;
  if (movie.providers.buy.length > 0) return `Buy: ${movie.providers.buy.slice(0, 4).join(", ")}`;
  return "Availability: no providers found";
}

function renderGapMovie(movie: CollectionGapMovie, index: number): string {
  const serviceMatch = movie.providerMatch.length > 0
    ? `\nPreferred service match: ${movie.providerMatch.join(", ")}`
    : "";
  return `${index + 1}. ${movie.title} (${movie.year}) - ID: ${movie.id}\n` +
    `Status: ${movie.status}\n` +
    `Rating: ${movie.rating.toFixed(1)}/10 | Runtime: ${formatRuntime(movie.runtime || 0)}\n` +
    `${availabilityLine(movie)}${serviceMatch}\n` +
    `Note: ${movie.note}`;
}

export async function buildCollectionGapPlan(
  env: Env,
  rawInput: CollectionGapInput,
): Promise<CollectionGapPlanResult> {
  const query = String(rawInput.query || "").trim();
  if (!query) {
    throw new Error("build_collection_gap_plan requires a franchise or collection query.");
  }

  const services = normalizeServices(rawInput.services);
  const watchedTitles = normalizeWatchedTitles(rawInput.watchedTitles);
  const guide: FranchiseGuideResult = await buildFranchiseWatchOrder(env, {
    query,
    country: rawInput.country,
    maxMovies: rawInput.maxMovies,
  });
  const isWatched = watchedMatcher(watchedTitles);
  const releaseOrder = guide.releaseOrder.map((movie) =>
    toGapMovie(movie, isWatched(movie) ? "watched" : "missing", services),
  );
  const watched = releaseOrder.filter((movie) => movie.status === "watched");
  const missing = releaseOrder.filter((movie) => movie.status === "missing");
  const missingById = new Map(missing.map((movie) => [movie.id, movie]));
  const suggestedMissing = guide.suggestedOrder
    .map((movie) => missingById.get(movie.id))
    .filter((movie): movie is CollectionGapMovie => Boolean(movie));
  const remaining = missing.filter((movie) => !suggestedMissing.some((item) => item.id === movie.id));
  const completionPath = [...suggestedMissing, ...remaining]
    .map((movie, index) => ({ ...movie, gapScore: scoreMissing(movie, index) }))
    .sort((a, b) => (b.gapScore || 0) - (a.gapScore || 0))
    .slice(0, 8);
  const watchedRuntimeMinutes = runtimeTotal(watched);
  const remainingRuntimeMinutes = runtimeTotal(missing);
  const completionPercent = releaseOrder.length > 0
    ? Math.round((watched.length / releaseOrder.length) * 100)
    : 0;
  const preferredNow = missing.filter((movie) => movie.providerMatch.length > 0);
  const streamingNow = missing.filter((movie) => movie.availableNow);

  return {
    generatedAt: new Date().toISOString(),
    query,
    country: guide.country,
    services,
    watchedTitles,
    collectionId: guide.collectionId,
    collectionName: guide.collectionName,
    completionPercent,
    watchedRuntimeMinutes,
    remainingRuntimeMinutes,
    totalRuntimeMinutes: guide.totalRuntimeMinutes,
    watched,
    missing,
    completionPath,
    releaseOrder,
    decision: [
      `${watched.length} of ${releaseOrder.length} entries are marked watched.`,
      missing.length > 0
        ? `Next best gap: ${completionPath[0]?.title || missing[0]?.title}.`
        : "No collection gaps found for the watched list provided.",
      streamingNow.length > 0
        ? `${streamingNow.length} missing entries have subscription streaming data for ${guide.country}.`
        : `No missing entries have subscription streaming data for ${guide.country}.`,
      preferredNow.length > 0
        ? `${preferredNow.length} missing entries match preferred services.`
        : undefined,
    ].filter((line): line is string => Boolean(line)),
    notes: [
      "Watched matching accepts exact normalized titles or TMDB movie IDs.",
      "Completion path starts from the franchise suggested order, then favors ratings, subscription availability, and preferred-service matches.",
      ...guide.notes,
    ],
  };
}

export function collectionGapPlanSummary(result: CollectionGapPlanResult): string {
  const watched = result.watched.map(renderGapMovie).join("\n---\n") || "No watched entries matched.";
  const missing = result.missing.map(renderGapMovie).join("\n---\n") || "No missing entries.";
  const completionPath = result.completionPath.map(renderGapMovie).join("\n---\n") || "No gaps found.";
  const releaseOrder = result.releaseOrder
    .map((movie, index) => `${index + 1}. ${movie.title} (${movie.year}) - ${movie.status}`)
    .join("\n");

  return `Collection Gap Plan\n` +
    `Query: ${result.query}\n` +
    `Collection: ${result.collectionName} - ID: ${result.collectionId}\n` +
    `Country: ${result.country}\n` +
    `Preferred services: ${result.services.length ? result.services.join(", ") : "any"}\n` +
    `Completion: ${result.completionPercent}%\n` +
    `Watched runtime: ${formatRuntime(result.watchedRuntimeMinutes)}\n` +
    `Remaining runtime: ${formatRuntime(result.remainingRuntimeMinutes)}\n\n` +
    `Decision:\n${result.decision.map((line) => `- ${line}`).join("\n")}\n\n` +
    `Recommended completion path:\n${completionPath}\n\n` +
    `Watched:\n${watched}\n\n` +
    `Missing:\n${missing}\n\n` +
    `Release order:\n${releaseOrder || "No collection entries found."}\n\n` +
    `Notes:\n${result.notes.map((note) => `- ${note}`).join("\n")}`;
}
