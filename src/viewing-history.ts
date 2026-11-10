import { z } from "zod";

/** Caller-owned history only: neither MCP transport stores personal watch state. */
export const excludedMovieIdsSchema = z.array(z.number().int().positive()).max(2000).optional()
  .describe("Watched or unwanted TMDB movie IDs to exclude; supplied by the caller");

export function excludedMovieIds(value: unknown): Set<number> {
  return new Set(excludedMovieIdsSchema.parse(value) || []);
}
