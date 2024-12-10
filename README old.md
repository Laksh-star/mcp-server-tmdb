# TMDB MCP Server

This MCP server integrates with The Movie Database (TMDB) API to provide movie information and search capabilities.

## Features

### Tools

- **search_movies**
  - Search for movies by title or keywords
  - Returns detailed movie information including title, release date, rating, and overview

- **get_recommendations**
  - Get movie recommendations based on a specific movie ID
  - Returns top 5 recommended movies with details

- **get_trending**
  - Get trending movies for either daily or weekly time windows
  - Returns top 10 trending movies with details

### Resources

The server provides access to movie information:

- **Movies** (`tmdb:///movie/<movie_id>`)
  - Includes title, release date, rating, overview, genres
  - Links to movie posters
  - Additional metadata

## Setup

1. Get a TMDB API key:
   - Sign up at [TMDB](https://www.themoviedb.org/)
   - Go to your account settings
   - Navigate to the API section
   - Request an API key for developer use

2. Set up environment:
   ```bash
   export TMDB_API_KEY=your_api_key_here
   ```

## Integration with Claude Desktop

Add the following to your app's server configuration:

```json
{
  "mcpServers": {
    "tmdb": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-tmdb"
      ],
      "env": {
        "TMDB_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Usage Examples

1. Search for movies:
   ```
   Use the search_movies tool with a query parameter
   ```

2. Get movie recommendations:
   ```
   Use the get_recommendations tool with a movieId parameter
   ```

3. Get trending movies:
   ```
   Use the get_trending tool with timeWindow parameter (day/week)
   ```

## License

MIT License