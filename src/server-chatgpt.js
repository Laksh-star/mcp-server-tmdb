#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Debug environment variables
console.log('🔍 Environment variables check:');
console.log('PORT:', process.env.PORT);
console.log('TMDB_API_KEY exists:', !!process.env.TMDB_API_KEY);
console.log('TMDB_API_KEY length:', process.env.TMDB_API_KEY?.length);

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
  console.error('❌ TMDB_API_KEY environment variable is required');
  console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('TMDB')));
  process.exit(1);
}

// Create the MCP server
const server = new Server(
  {
    name: 'tmdb-chatgpt-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools with ChatGPT-required names
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search', // ChatGPT requires this exact name
        description: 'Search for movies using TMDB API',
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
        name: 'fetch', // ChatGPT requires this exact name
        description: 'Fetch detailed movie information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'TMDB movie ID',
            },
          },
          required: ['id'],
        },
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search': {
        const query = encodeURIComponent(args.query);
        const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${query}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'fetch': {
        const movieId = args.id;
        const url = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,reviews`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Basic status endpoint
app.get('/', (req, res) => {
  console.log('✅ Root endpoint hit');
  res.json({
    name: 'TMDB ChatGPT MCP Server',
    version: '1.0.0',
    status: 'running',
    transport: 'StreamableHTTP',
    endpoints: {
      mcp: '/mcp'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  console.log('❤️ Health check hit');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint hit');
  res.send('Server is working!');
});

// Start server
const PORT = process.env.PORT || 3000;

async function main() {
  try {
    // Create the transport with proper path
    const transport = new StreamableHTTPServerTransport(app, server, {
      path: '/mcp'
    });
    
    console.log('🚀 Transport created successfully');
    
    // Start the HTTP server
    app.listen(PORT, () => {
      console.log(`🎬 TMDB ChatGPT MCP Server running on port ${PORT}`);
      console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
      console.log(`🌐 Status: http://localhost:${PORT}/`);
      console.log(`❤️ Health: http://localhost:${PORT}/health`);
      console.log(`🧪 Test: http://localhost:${PORT}/test`);
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

main().catch(console.error);
