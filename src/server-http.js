#!/usr/bin/env node

import express from "express";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Map to store transports by session ID
const transports = {};

// Create MCP Server
const server = new Server(
  {
    name: 'mcp-server-tmdb',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Required tools for ChatGPT
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search',
        description: 'Search for movies by title or keywords using TMDB',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for movies',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'fetch',
        description: 'Fetch detailed information about a specific movie by ID',
        inputSchema: {
          type: 'object',
          properties: {
            movieId: {
              type: 'string',
              description: 'TMDB movie ID to fetch details for',
            },
          },
          required: ['movieId'],
        },
      },
      {
        name: 'get_recommendations',
        description: 'Get movie recommendations based on a movie ID',
        inputSchema: {
          type: 'object',
          properties: {
            movieId: {
              type: 'string',
              description: 'TMDB movie ID',
            },
          },
          required: ['movieId'],
        },
      },
      {
        name: 'get_trending',
        description: 'Get trending movies for a specified time window',
        inputSchema: {
          type: 'object',
          properties: {
            timeWindow: {
              type: 'string',
              description: 'Time window: "day" or "week"',
              enum: ['day', 'week'],
            },
          },
          required: ['timeWindow'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const apiKey = process.env.TMDB_API_KEY;
  
  if (!apiKey) {
    throw new Error('TMDB_API_KEY environment variable is required');
  }

  try {
    switch (name) {
      case 'search': {
        const response = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(args.query)}`
        );
        const data = await response.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      
      case 'fetch': {
        const response = await fetch(
          `https://api.themoviedb.org/3/movie/${args.movieId}?api_key=${apiKey}`
        );
        const data = await response.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      
      case 'get_recommendations': {
        const response = await fetch(
          `https://api.themoviedb.org/3/movie/${args.movieId}/recommendations?api_key=${apiKey}`
        );
        const data = await response.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      
      case 'get_trending': {
        const response = await fetch(
          `https://api.themoviedb.org/3/trending/movie/${args.timeWindow}?api_key=${apiKey}`
        );
        const data = await response.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new Error(`Tool execution failed: ${error.message}`);
  }
});

// Handle POST requests for client-to-server communication
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || randomUUID();
  
  let transport;
  if (transports[sessionId]) {
    transport = transports[sessionId];
  } else {
    transport = new StreamableHTTPServerTransport(server);
    transports[sessionId] = transport;
  }
  
  // Set session ID in response header
  res.setHeader('Mcp-Session-Id', sessionId);
  
  await transport.handlePostRequest(req, res);
});

// Handle GET requests for server-to-client streaming
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || randomUUID();
  
  let transport;
  if (transports[sessionId]) {
    transport = transports[sessionId];
  } else {
    transport = new StreamableHTTPServerTransport(server);
    transports[sessionId] = transport;
  }
  
  // Set session ID in response header
  res.setHeader('Mcp-Session-Id', sessionId);
  
  await transport.handleGetRequest(req, res);
});

// Status endpoint
app.get('/', (req, res) => {
  res.json({ 
    name: 'TMDB MCP Server',
    version: '1.0.0',
    status: 'running',
    transport: 'streamable-http',
    endpoints: {
      mcp: '/mcp'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TMDB MCP Server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
