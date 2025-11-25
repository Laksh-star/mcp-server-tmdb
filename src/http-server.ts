#!/usr/bin/env node

import express from "express";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const transports = new Map<string, StreamableHTTPServerTransport>();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

if (!TMDB_API_KEY) {
  console.error("TMDB_API_KEY environment variable is required");
  process.exit(1);
}

const server = new Server(
  {
    name: 'mcp-server-tmdb',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
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
  if (!response.ok) throw new Error(`TMDB API error: ${response.statusText}`);
  return response.json() as Promise<T>;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_movies',
      description: 'Search for movies by title or keywords',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query for movies' } },
        required: ['query'],
      },
    },
    {
      name: 'get_recommendations',
      description: 'Get movie recommendations based on a movie ID',
      inputSchema: {
        type: 'object',
        properties: { movieId: { type: 'string', description: 'TMDB movie ID' } },
        required: ['movieId'],
      },
    },
    {
      name: 'get_trending',
      description: 'Get trending movies for a specified time window',
      inputSchema: {
        type: 'object',
        properties: { timeWindow: { type: 'string', enum: ['day', 'week'] } },
        required: ['timeWindow'],
      },
    },
  ],
}));

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const data: any = await fetchFromTMDB("/movie/popular", { page: request.params?.cursor || "1" });
  return {
    resources: data.results.map((m: any) => ({
      uri: `tmdb:///movie/${m.id}`,
      mimeType: "application/json",
      name: `${m.title} (${m.release_date?.split("-")[0]})`,
    })),
    nextCursor: data.page < data.total_pages ? String(data.page + 1) : undefined,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const movieId = request.params.uri.replace("tmdb:///movie/", "");
  const movie: any = await fetchFromTMDB(`/movie/${movieId}`, { append_to_response: "credits,reviews" });
  return {
    contents: [{
      uri: request.params.uri,
      mimeType: "application/json",
      text: JSON.stringify({
        title: movie.title,
        releaseDate: movie.release_date,
        rating: movie.vote_average,
        overview: movie.overview,
        genres: movie.genres?.map((g: any) => g.name).join(", "),
        posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        cast: movie.credits?.cast?.slice(0, 5).map((a: any) => `${a.name} as ${a.character}`),
        director: movie.credits?.crew?.find((p: any) => p.job === "Director")?.name,
      }, null, 2),
    }],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case 'search_movies': {
        const data: any = await fetchFromTMDB("/search/movie", { query: args?.query as string });
        return {
          content: [{
            type: 'text',
            text: `Found ${data.results.length} movies:\n\n` + data.results.map((m: any) =>
              `${m.title} (${m.release_date?.split("-")[0]}) - ID: ${m.id}\nRating: ${m.vote_average}/10\nOverview: ${m.overview}`
            ).join("\n---\n"),
          }],
        };
      }
      case 'get_recommendations': {
        const data: any = await fetchFromTMDB(`/movie/${args?.movieId}/recommendations`);
        return {
          content: [{
            type: 'text',
            text: "Top 5 recommendations:\n\n" + data.results.slice(0, 5).map((m: any) =>
              `${m.title} (${m.release_date?.split("-")[0]})\nRating: ${m.vote_average}/10\nOverview: ${m.overview}`
            ).join("\n---\n"),
          }],
        };
      }
      case 'get_trending': {
        const data: any = await fetchFromTMDB(`/trending/movie/${args?.timeWindow}`);
        return {
          content: [{
            type: 'text',
            text: `Trending movies for the ${args?.timeWindow}:\n\n` + data.results.slice(0, 10).map((m: any) =>
              `${m.title} (${m.release_date?.split("-")[0]})\nRating: ${m.vote_average}/10\nOverview: ${m.overview}`
            ).join("\n---\n"),
          }],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

app.all('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  let transport = transports.get(sessionId);
  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { transports.set(id, transport!); },
      onsessionclosed: (id) => { transports.delete(id); },
    });
    await server.connect(transport);
  }
  await transport.handleRequest(req, res, req.body);
});

app.get('/', (req, res) => {
  res.json({
    name: 'TMDB MCP Server',
    version: '1.0.0',
    status: 'running',
    transport: 'streamable-http',
    endpoints: { mcp: '/mcp' }
  });
});

const HOST = process.env.HOST || 'localhost';
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, HOST, () => {
  console.log(`TMDB MCP Server running on http://${HOST}:${PORT}`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
});
