#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_movies',
        description: 'Search for movies by title or keywords',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
          },
          required: ['query'],
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
      case 'search_movies': {
        const response = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(args.query)}`
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

// Create SSE transport
const transport = new SSEServerTransport('/messages', server);

// Set up routes
app.get('/sse', async (req, res) => {
  return transport.handleSSEConnection(req, res);
});

app.post('/messages', async (req, res) => {
  return transport.handlePostRequest(req, res);
});

app.get('/', (req, res) => {
  res.json({ 
    name: 'TMDB MCP Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      sse: '/sse',
      messages: '/messages'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TMDB MCP Server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Messages endpoint: http://localhost:${PORT}/messages`);
});
