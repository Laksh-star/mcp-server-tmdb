# TMDB MCP Server

An MCP server that integrates with The Movie Database (TMDB) API. Provides movie and TV search, streaming availability, cast/crew details, and recommendations — designed for use with AI assistants like Claude.

## Tools

### Movie Discovery
- **search_movies** — Search by title/keywords → titles, IDs, ratings, overviews
- **get_trending** — Top 10 trending movies (`timeWindow`: "day" | "week")
- **search_by_genre** — Movies by genre name, optional year filter
- **advanced_search** — Filter by genre, year, min rating, sort, language
- **search_by_keyword** — Find movies by theme/keyword (e.g. "zombie", "heist")

### Movie Details
- **get_movie_details** — Full details: cast, crew, runtime, genres, reviews (by `movieId`)
- **get_recommendations** — Top 5 recommendations based on a movie ID
- **get_similar_movies** — Similar movies via TMDB's similarity algorithm
- **get_watch_providers** — Streaming/rental/purchase availability by country (default: IN)

### TV Shows
- **search_tv_shows** — Search TV series by title
- **get_trending_tv** — Top 10 trending TV shows (`timeWindow`: "day" | "week")

### People
- **search_person** — Find actors, directors, crew by name → ID + known works
- **get_person_details** — Full bio + filmography (movies + TV) by `personId`

### Resources
- `tmdb:///movie/<id>` — Full movie details in JSON (title, cast, director, reviews, poster URL)

## Getting Started

1. Get a TMDB API key at [themoviedb.org](https://www.themoviedb.org/) → Account Settings → API

2. Clone and build:
   ```bash
   git clone https://github.com/Laksh-star/mcp-server-tmdb.git
   cd mcp-server-tmdb
   npm install
   npm run build
   ```

3. Set your API key:
   ```bash
   export TMDB_API_KEY=your_api_key_here
   ```

## Usage with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tmdb": {
      "command": "node",
      "args": ["/full/path/to/mcp-server-tmdb/dist/index.js"],
      "env": {
        "TMDB_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Usage with BizClaw / NanoClaw

Built into the agent container. Just set `TMDB_API_KEY` in your `.env` file — no configuration needed.

## Example Prompts

```
"What's trending in movies this week?"
"Find me Thriller movies from 2023"
"Who is Christopher Nolan and what has he directed?"
"Where can I watch Inception in India?"
"Get details for movie ID 550 (Fight Club)"
"Find movies similar to Interstellar"
"What are the trending TV shows right now?"
```

## License

MIT
