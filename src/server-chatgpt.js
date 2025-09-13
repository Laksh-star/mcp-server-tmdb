#!/usr/bin/env node

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import fetch from 'node-fetch';
import cors from 'cors';

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

// Create MCP server using the new McpServer class
const server = new McpServer({
  name: 'tmdb-chatgpt-mcp',
  version: '1.0.0'
});

// Define tools using the new server.tool() method
server.tool(
  'search', // ChatGPT requires this exact name
  'Search for movies using TMDB API',
  {
    query: z.string().describe('Search query for movies')
  },
  async ({ query }) => {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodedQuery}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error searching movies: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

server.tool(
  'fetch', // ChatGPT requires this exact name
  'Fetch detailed movie information by ID',
  {
    id: z.string().describe('TMDB movie ID')
  },
  async ({ id }) => {
    try {
      const url = `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,reviews`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching movie details: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }
);

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Map to store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {};

// Helper function to get or create a server instance
function getServer(): McpServer {
  return server;
}

// Main MCP endpoint - Handle POST requests
app.post('/mcp', async (req: Request, res: Response) => {
  console.log('📡 POST /mcp request received');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);

  // Check for existing session ID
  const sessionId = req.headers['mcp-session-id'] as string || randomUUID();
  let transport: StreamableHTTPServerTransport;

  try {
    if (transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
      console.log(`♻️ Reusing transport for session: ${sessionId}`);
    } else {
      // Create new transport for this session
      const mcpServer = getServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
      });
      
      console.log(`🆕 Creating new transport for session: ${sessionId}`);
      
      // Store transport
      transports[sessionId] = transport;
      
      // Connect server to transport
      await mcpServer.connect(transport);
      
      // Set response header
      res.setHeader('mcp-session-id', sessionId);
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
    
  } catch (error) {
    console.error('❌ Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error.message
        },
        id: null
      });
    }
  }
});

// Handle GET requests (for SSE - optional)
app.get('/mcp', async (req: Request, res: Response) => {
  console.log('📡 GET /mcp request received');
  // For stateless mode, we don't support SSE
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed. Use POST for requests.'
    },
    id: null
  });
});

// Status endpoint
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
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeSessions: Object.keys(transports).length
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint hit');
  res.send('TMDB MCP Server is working!');
});

// Start server
const PORT = process.env.PORT || 3000;

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
  
  // Close all transports
  for (const [sessionId, transport] of Object.entries(transports)) {
    try {
      console.log(`Closing transport for session: ${sessionId}`);
      await transport.close();
    } catch (error) {
      console.error(`Error closing transport ${sessionId}:`, error);
    }
  }
  
  process.exit(0);
});
