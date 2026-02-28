#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fetch from 'node-fetch';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Type definitions
interface Movie {
  id: number;
  title: string;
  release_date: string;
  vote_average: number;
  overview: string;
  poster_path?: string;
  runtime?: number;
  budget?: number;
  revenue?: number;
  genres?: Array<{ id: number; name: string }>;
}

interface TMDBResponse {
  page: number;
  results: Movie[];
  total_pages: number;
}

interface MovieDetails extends Movie {
  credits?: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
    }>;
    crew: Array<{
      name: string;
      job: string;
      department: string;
    }>;
  };
  reviews?: {
    results: Array<{
      author: string;
      content: string;
      rating?: number;
    }>;
  };
}

interface Person {
  id: number;
  name: string;
  known_for_department: string;
  popularity: number;
  profile_path?: string;
  known_for: Movie[];
}

interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday?: string;
  place_of_birth?: string;
  known_for_department: string;
  popularity: number;
  movie_credits?: {
    cast: Array<{ id: number; title: string; release_date: string; character: string; vote_average: number }>;
    crew: Array<{ id: number; title: string; release_date: string; job: string; department: string }>;
  };
  tv_credits?: {
    cast: Array<{ id: number; name: string; first_air_date: string; character: string; vote_average: number }>;
  };
}

interface PersonResponse {
  page: number;
  results: Person[];
  total_pages: number;
}

interface Keyword {
  id: number;
  name: string;
}

interface KeywordResponse {
  page: number;
  results: Keyword[];
  total_pages: number;
}

interface TVShow {
  id: number;
  name: string;
  first_air_date: string;
  vote_average: number;
  overview: string;
  poster_path?: string;
}

interface TVResponse {
  page: number;
  results: TVShow[];
  total_pages: number;
}

interface WatchProviderResult {
  link?: string;
  flatrate?: Array<{ provider_name: string; logo_path: string }>;
  rent?: Array<{ provider_name: string; logo_path: string }>;
  buy?: Array<{ provider_name: string; logo_path: string }>;
}

interface WatchProvidersResponse {
  results: Record<string, WatchProviderResult>;
}

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const server = new Server(
  {
    name: "example-servers/tmdb",
    version: "2.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

async function fetchFromTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append("api_key", TMDB_API_KEY!);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function getMovieDetails(movieId: string): Promise<MovieDetails> {
  return fetchFromTMDB<MovieDetails>(`/movie/${movieId}`, { append_to_response: "credits,reviews" });
}

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const params: Record<string, string> = {
    page: request.params?.cursor || "1",
  };

  const data = await fetchFromTMDB<TMDBResponse>("/movie/popular", params);

  return {
    resources: data.results.map((movie) => ({
      uri: `tmdb:///movie/${movie.id}`,
      mimeType: "application/json",
      name: `${movie.title} (${movie.release_date.split("-")[0]})`,
    })),
    nextCursor: data.page < data.total_pages ? String(data.page + 1) : undefined,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const movieId = request.params.uri.replace("tmdb:///movie/", "");
  const movie = await getMovieDetails(movieId);

  const movieInfo = {
    title: movie.title,
    releaseDate: movie.release_date,
    rating: movie.vote_average,
    overview: movie.overview,
    genres: movie.genres?.map(g => g.name).join(", "),
    runtime: movie.runtime ? `${movie.runtime} min` : undefined,
    posterUrl: movie.poster_path ?
      `https://image.tmdb.org/t/p/w500${movie.poster_path}` :
      "No poster available",
    cast: movie.credits?.cast?.slice(0, 5).map(actor => `${actor.name} as ${actor.character}`),
    director: movie.credits?.crew?.find(person => person.job === "Director")?.name,
    reviews: movie.reviews?.results?.slice(0, 3).map(review => ({
      author: review.author,
      content: review.content,
      rating: review.rating
    }))
  };

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(movieInfo, null, 2),
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_movies",
        description: "Search for movies by title or keywords",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for movie titles",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_recommendations",
        description: "Get movie recommendations based on a movie ID",
        inputSchema: {
          type: "object",
          properties: {
            movieId: {
              type: "string",
              description: "TMDB movie ID to get recommendations for",
            },
          },
          required: ["movieId"],
        },
      },
      {
        name: "get_trending",
        description: "Get trending movies for a time window",
        inputSchema: {
          type: "object",
          properties: {
            timeWindow: {
              type: "string",
              enum: ["day", "week"],
              description: "Time window for trending movies",
            },
          },
          required: ["timeWindow"],
        },
      },
      {
        name: "search_by_genre",
        description: "Search for movies by genre",
        inputSchema: {
          type: "object",
          properties: {
            genre: {
              type: "string",
              description: "Genre name (e.g., 'action', 'comedy', 'horror')",
            },
            year: {
              type: "string",
              description: "Optional year filter",
            },
          },
          required: ["genre"],
        },
      },
      {
        name: "advanced_search",
        description: "Advanced movie search with multiple filters",
        inputSchema: {
          type: "object",
          properties: {
            genre: {
              type: "string",
              description: "Genre name (optional)",
            },
            year: {
              type: "string",
              description: "Release year (optional)",
            },
            minRating: {
              type: "string",
              description: "Minimum rating (0-10, optional)",
            },
            sortBy: {
              type: "string",
              enum: ["popularity.desc", "popularity.asc", "vote_average.desc", "vote_average.asc", "release_date.desc", "release_date.asc"],
              description: "Sort order (optional, defaults to popularity.desc)",
            },
            language: {
              type: "string",
              description: "Language code (e.g., 'en', 'es', 'fr', optional)",
            },
          },
        },
      },
      {
        name: "search_person",
        description: "Search for actors, directors, or other people in the film industry",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Person's name to search for",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "search_by_keyword",
        description: "Search for movies by keywords or themes",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "Keyword or theme to search for (e.g., 'artificial intelligence', 'space', 'zombie')",
            },
          },
          required: ["keyword"],
        },
      },
      {
        name: "get_movie_details",
        description: "Get full details for a movie including cast, crew, runtime, budget, and reviews",
        inputSchema: {
          type: "object",
          properties: {
            movieId: {
              type: "string",
              description: "TMDB movie ID",
            },
          },
          required: ["movieId"],
        },
      },
      {
        name: "get_watch_providers",
        description: "Get streaming, rental, and purchase availability for a movie by country",
        inputSchema: {
          type: "object",
          properties: {
            movieId: {
              type: "string",
              description: "TMDB movie ID",
            },
            country: {
              type: "string",
              description: "ISO 3166-1 country code (e.g., 'US', 'IN', 'GB'). Defaults to 'IN'.",
            },
          },
          required: ["movieId"],
        },
      },
      {
        name: "search_tv_shows",
        description: "Search for TV shows and series by title",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for TV show titles",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_trending_tv",
        description: "Get trending TV shows for a time window",
        inputSchema: {
          type: "object",
          properties: {
            timeWindow: {
              type: "string",
              enum: ["day", "week"],
              description: "Time window for trending TV shows",
            },
          },
          required: ["timeWindow"],
        },
      },
      {
        name: "get_person_details",
        description: "Get full biography and filmography for an actor or director",
        inputSchema: {
          type: "object",
          properties: {
            personId: {
              type: "string",
              description: "TMDB person ID (from search_person results)",
            },
          },
          required: ["personId"],
        },
      },
      {
        name: "get_similar_movies",
        description: "Get movies similar to a given movie (uses TMDB similarity algorithm, different from recommendations)",
        inputSchema: {
          type: "object",
          properties: {
            movieId: {
              type: "string",
              description: "TMDB movie ID",
            },
          },
          required: ["movieId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "search_movies": {
        const query = request.params.arguments?.query as string;
        const data = await fetchFromTMDB<TMDBResponse>("/search/movie", { query });

        const results = data.results
          .map((movie) =>
            `${movie.title} (${movie.release_date?.split("-")[0]}) - ID: ${movie.id}\n` +
            `Rating: ${movie.vote_average}/10\n` +
            `Overview: ${movie.overview}\n`
          )
          .join("\n---\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${data.results.length} movies:\n\n${results}`,
            },
          ],
          isError: false,
        };
      }

      case "get_recommendations": {
        const movieId = request.params.arguments?.movieId as string;
        const data = await fetchFromTMDB<TMDBResponse>(`/movie/${movieId}/recommendations`);

        const recommendations = data.results
          .slice(0, 5)
          .map((movie) =>
            `${movie.title} (${movie.release_date?.split("-")[0]})\n` +
            `Rating: ${movie.vote_average}/10\n` +
            `Overview: ${movie.overview}\n`
          )
          .join("\n---\n");

        return {
          content: [
            {
              type: "text",
              text: `Top 5 recommendations:\n\n${recommendations}`,
            },
          ],
          isError: false,
        };
      }

      case "get_trending": {
        const timeWindow = request.params.arguments?.timeWindow as string;
        const data = await fetchFromTMDB<TMDBResponse>(`/trending/movie/${timeWindow}`);

        const trending = data.results
          .slice(0, 10)
          .map((movie) =>
            `${movie.title} (${movie.release_date?.split("-")[0]})\n` +
            `Rating: ${movie.vote_average}/10\n` +
            `Overview: ${movie.overview}\n`
          )
          .join("\n---\n");

        return {
          content: [
            {
              type: "text",
              text: `Trending movies for the ${timeWindow}:\n\n${trending}`,
            },
          ],
          isError: false,
        };
      }

      case "search_by_genre": {
        const genre = request.params.arguments?.genre as string;
        const year = request.params.arguments?.year as string;

        const genresData = await fetchFromTMDB<{genres: Array<{id: number, name: string}>}>("/genre/movie/list");
        const genreObj = genresData.genres.find(g => g.name.toLowerCase() === genre.toLowerCase());

        if (!genreObj) {
          return {
            content: [
              {
                type: "text",
                text: `Genre "${genre}" not found. Available genres: ${genresData.genres.map(g => g.name).join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        const params: Record<string, string> = {
          with_genres: genreObj.id.toString(),
          sort_by: "popularity.desc"
        };

        if (year) {
          params.year = year;
        }

        const data = await fetchFromTMDB<TMDBResponse>("/discover/movie", params);

        const results = data.results
          .slice(0, 10)
          .map((movie) =>
            `${movie.title} (${movie.release_date?.split("-")[0]}) - ID: ${movie.id}\n` +
            `Rating: ${movie.vote_average}/10\n` +
            `Overview: ${movie.overview}\n`
          )
          .join("\n---\n");

        const yearFilter = year ? ` from ${year}` : "";
        return {
          content: [
            {
              type: "text",
              text: `Found ${Math.min(data.results.length, 10)} ${genre} movies${yearFilter}:\n\n${results}`,
            },
          ],
          isError: false,
        };
      }

      case "advanced_search": {
        const genre = request.params.arguments?.genre as string;
        const year = request.params.arguments?.year as string;
        const minRating = request.params.arguments?.minRating as string;
        const sortBy = (request.params.arguments?.sortBy as string) || "popularity.desc";
        const language = request.params.arguments?.language as string;

        const params: Record<string, string> = {
          sort_by: sortBy
        };

        if (genre) {
          const genresData = await fetchFromTMDB<{genres: Array<{id: number, name: string}>}>("/genre/movie/list");
          const genreObj = genresData.genres.find(g => g.name.toLowerCase() === genre.toLowerCase());

          if (!genreObj) {
            return {
              content: [
                {
                  type: "text",
                  text: `Genre "${genre}" not found. Available genres: ${genresData.genres.map(g => g.name).join(", ")}`,
                },
              ],
              isError: true,
            };
          }
          params.with_genres = genreObj.id.toString();
        }

        if (year) params.year = year;
        if (minRating) params["vote_average.gte"] = minRating;
        if (language) params.with_original_language = language;

        const data = await fetchFromTMDB<TMDBResponse>("/discover/movie", params);

        const results = data.results
          .slice(0, 10)
          .map((movie) =>
            `${movie.title} (${movie.release_date?.split("-")[0]}) - ID: ${movie.id}\n` +
            `Rating: ${movie.vote_average}/10\n` +
            `Overview: ${movie.overview}\n`
          )
          .join("\n---\n");

        const filters = [];
        if (genre) filters.push(`Genre: ${genre}`);
        if (year) filters.push(`Year: ${year}`);
        if (minRating) filters.push(`Min Rating: ${minRating}/10`);
        if (language) filters.push(`Language: ${language}`);
        const filterText = filters.length > 0 ? ` (${filters.join(", ")})` : "";

        return {
          content: [
            {
              type: "text",
              text: `Found ${Math.min(data.results.length, 10)} movies${filterText}:\n\n${results}`,
            },
          ],
          isError: false,
        };
      }

      case "search_person": {
        const name = request.params.arguments?.name as string;
        const data = await fetchFromTMDB<PersonResponse>("/search/person", { query: name });

        const results = data.results
          .slice(0, 5)
          .map((person) => {
            const knownFor = person.known_for
              .slice(0, 3)
              .map(movie => `${movie.title} (${movie.release_date?.split("-")[0]})`)
              .join(", ");

            return `${person.name} - ID: ${person.id}\n` +
                   `Department: ${person.known_for_department}\n` +
                   `Known for: ${knownFor}\n` +
                   `Popularity: ${person.popularity.toFixed(1)}`;
          })
          .join("\n---\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${Math.min(data.results.length, 5)} people matching "${name}":\n\n${results}`,
            },
          ],
          isError: false,
        };
      }

      case "search_by_keyword": {
        const keyword = request.params.arguments?.keyword as string;

        const keywordData = await fetchFromTMDB<KeywordResponse>("/search/keyword", { query: keyword });

        if (keywordData.results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No keywords found matching "${keyword}". Try using more general terms or different keywords.`,
              },
            ],
            isError: false,
          };
        }

        const keywordId = keywordData.results[0].id;
        const keywordName = keywordData.results[0].name;

        const movieData = await fetchFromTMDB<TMDBResponse>("/discover/movie", {
          with_keywords: keywordId.toString(),
          sort_by: "popularity.desc"
        });

        const results = movieData.results
          .slice(0, 10)
          .map((movie) =>
            `${movie.title} (${movie.release_date?.split("-")[0]}) - ID: ${movie.id}\n` +
            `Rating: ${movie.vote_average}/10\n` +
            `Overview: ${movie.overview}\n`
          )
          .join("\n---\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${Math.min(movieData.results.length, 10)} movies with keyword "${keywordName}":\n\n${results}`,
            },
          ],
          isError: false,
        };
      }

      case "get_movie_details": {
        const movieId = request.params.arguments?.movieId as string;
        const movie = await getMovieDetails(movieId);

        const director = movie.credits?.crew?.find(p => p.job === "Director")?.name;
        const writers = movie.credits?.crew
          ?.filter(p => p.job === "Screenplay" || p.job === "Writer" || p.job === "Story")
          .slice(0, 3)
          .map(p => p.name)
          .join(", ");
        const cast = movie.credits?.cast?.slice(0, 8).map(a => `${a.name} as ${a.character}`).join("\n  ");
        const topReview = movie.reviews?.results?.[0];

        const lines = [
          `**${movie.title}** (${movie.release_date?.split("-")[0]})`,
          `ID: ${movie.id}`,
          `Rating: ${movie.vote_average}/10`,
          movie.runtime ? `Runtime: ${movie.runtime} min` : null,
          movie.genres?.length ? `Genres: ${movie.genres.map(g => g.name).join(", ")}` : null,
          `\nOverview: ${movie.overview}`,
          director ? `\nDirector: ${director}` : null,
          writers ? `Writers: ${writers}` : null,
          cast ? `\nCast:\n  ${cast}` : null,
          topReview ? `\nTop Review by ${topReview.author}:\n"${topReview.content.slice(0, 300)}..."` : null,
        ].filter(Boolean).join("\n");

        return {
          content: [{ type: "text", text: lines }],
          isError: false,
        };
      }

      case "get_watch_providers": {
        const movieId = request.params.arguments?.movieId as string;
        const country = (request.params.arguments?.country as string) || "IN";

        const data = await fetchFromTMDB<WatchProvidersResponse>(`/movie/${movieId}/watch/providers`);
        const countryData = data.results[country];

        if (!countryData) {
          const availableCountries = Object.keys(data.results).slice(0, 10).join(", ");
          return {
            content: [{
              type: "text",
              text: `No watch providers found for ${country}. Available countries include: ${availableCountries}`,
            }],
            isError: false,
          };
        }

        const lines: string[] = [`Watch providers for this movie in ${country}:`];

        if (countryData.flatrate?.length) {
          lines.push(`\nStreaming (subscription):`);
          countryData.flatrate.forEach(p => lines.push(`  • ${p.provider_name}`));
        }
        if (countryData.rent?.length) {
          lines.push(`\nAvailable to rent:`);
          countryData.rent.forEach(p => lines.push(`  • ${p.provider_name}`));
        }
        if (countryData.buy?.length) {
          lines.push(`\nAvailable to buy:`);
          countryData.buy.forEach(p => lines.push(`  • ${p.provider_name}`));
        }
        if (countryData.link) {
          lines.push(`\nFull details: ${countryData.link}`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          isError: false,
        };
      }

      case "search_tv_shows": {
        const query = request.params.arguments?.query as string;
        const data = await fetchFromTMDB<TVResponse>("/search/tv", { query });

        const results = data.results
          .slice(0, 10)
          .map((show) =>
            `${show.name} (${show.first_air_date?.split("-")[0]}) - ID: ${show.id}\n` +
            `Rating: ${show.vote_average}/10\n` +
            `Overview: ${show.overview}\n`
          )
          .join("\n---\n");

        return {
          content: [{
            type: "text",
            text: `Found ${Math.min(data.results.length, 10)} TV shows matching "${query}":\n\n${results}`,
          }],
          isError: false,
        };
      }

      case "get_trending_tv": {
        const timeWindow = request.params.arguments?.timeWindow as string;
        const data = await fetchFromTMDB<TVResponse>(`/trending/tv/${timeWindow}`);

        const trending = data.results
          .slice(0, 10)
          .map((show) =>
            `${show.name} (${show.first_air_date?.split("-")[0]})\n` +
            `Rating: ${show.vote_average}/10\n` +
            `Overview: ${show.overview}\n`
          )
          .join("\n---\n");

        return {
          content: [{
            type: "text",
            text: `Trending TV shows for the ${timeWindow}:\n\n${trending}`,
          }],
          isError: false,
        };
      }

      case "get_person_details": {
        const personId = request.params.arguments?.personId as string;
        const person = await fetchFromTMDB<PersonDetails>(
          `/person/${personId}`,
          { append_to_response: "movie_credits,tv_credits" }
        );

        const topMovies = person.movie_credits?.cast
          ?.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
          .slice(0, 10)
          .map(m => `  • ${m.title} (${m.release_date?.split("-")[0]}) as ${m.character} — ${m.vote_average?.toFixed(1)}/10`)
          .join("\n");

        const directedMovies = person.movie_credits?.crew
          ?.filter(m => m.job === "Director")
          .sort((a, b) => b.release_date?.localeCompare(a.release_date || "") || 0)
          .slice(0, 5)
          .map(m => `  • ${m.title} (${m.release_date?.split("-")[0]})`)
          .join("\n");

        const topTV = person.tv_credits?.cast
          ?.slice(0, 5)
          .map(s => `  • ${s.name} (${s.first_air_date?.split("-")[0]}) as ${s.character}`)
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

        return {
          content: [{ type: "text", text: lines }],
          isError: false,
        };
      }

      case "get_similar_movies": {
        const movieId = request.params.arguments?.movieId as string;
        const data = await fetchFromTMDB<TMDBResponse>(`/movie/${movieId}/similar`);

        const similar = data.results
          .slice(0, 10)
          .map((movie) =>
            `${movie.title} (${movie.release_date?.split("-")[0]}) - ID: ${movie.id}\n` +
            `Rating: ${movie.vote_average}/10\n` +
            `Overview: ${movie.overview}\n`
          )
          .join("\n---\n");

        return {
          content: [{
            type: "text",
            text: `Similar movies:\n\n${similar}`,
          }],
          isError: false,
        };
      }

      default:
        throw new Error("Tool not found");
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
if (!TMDB_API_KEY) {
  console.error("TMDB_API_KEY environment variable is required");
  process.exit(1);
}

const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error("Server connection error:", error);
  process.exit(1);
});
