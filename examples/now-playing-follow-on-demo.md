# TMDB Cloudflare MCP Demo: Now Playing to Watch-Next

Generated: 2026-04-26T06:10:47.329Z
Mode: local
Server: mcp-server-tmdb
Endpoint: local stdio dist/index.js
Region: US

## Use Case

A user wants a movie they can act on tonight. The workflow starts with live theatrical discovery, chooses a current title, enriches it with details, checks watch-provider availability, then suggests follow-on movies with availability for the same region.

## MCP Tool Chain

1. `get_now_playing`
2. `get_movie_details`
3. `get_watch_providers`
4. `get_recommendations`
5. `get_similar_movies`

## Current Now-Playing Scan

1. The Super Mario Galaxy Movie (2026) - TMDB ID 1226863 - 6.768/10
2. Michael (2026) - TMDB ID 936075 - 7.5/10
3. Apex (2026) - TMDB ID 1318447 - 6.318/10
4. Project Hail Mary (2026) - TMDB ID 687163 - 8.2/10
5. Lee Cronin's The Mummy (2026) - TMDB ID 1304313 - 6.8/10
6. The Yeti (2026) - TMDB ID 1418657 - 6.671/10
7. Ready or Not 2: Here I Come (2026) - TMDB ID 1266127 - 6.9/10
8. The Drama (2026) - TMDB ID 1325734 - 7.033/10

## Primary Pick

The Super Mario Galaxy Movie (2026) - TMDB ID 1226863 - 6.768/10

### Details

```text
**The Super Mario Galaxy Movie** (2026)
ID: 1226863
Rating: 6.8/10
Runtime: 98 min
Genres: Family, Comedy, Adventure, Fantasy, Animation

Overview: Having thwarted Bowser's previous plot to marry Princess Peach, Mario and Luigi now face a fresh threat in Bowser Jr., who is determined to liberate his father from captivity and restore the family legacy. Alongside companions new and old, the brothers travel across the stars to stop the young heir's crusade.

Director: Michael Jelenic
Writers: Matthew Fogel

Cast:
  Chris Pratt as Mario (voice)
  Charlie Day as Luigi (voice)
  Anya Taylor-Joy as Princess Peach (voice)
  Jack Black as Bowser (voice)
  Keegan-Michael Key as Toad (voice)
  Benny Safdie as Bowser Jr. (voice)
```

### Provider Availability

```text
No watch providers found for US. Available countries include: CA
```

Decision: TMDB did not return direct provider availability for this pick in the selected region, so the follow-on list is useful as an alternate path.

## Follow-On Suggestions

Source: `get_similar_movies`

### 1. Secret Headquarters (2022) - TMDB ID 791155 - 6.397/10

While hanging out after school, Charlie and his friends discover the headquarters of the world’s most powerful superhero hidden beneath his home. When villains attack, they must team up to defend the headquarters and save the world.

```text
Watch providers for this movie in US:

Available to rent:
  • Amazon Video
  • Apple TV Store
  • Google Play Movies
  • YouTube
  • Fandango At Home
  • Spectrum On Demand
  • Plex

Available to buy:
  • Amazon Video
  • Apple TV Store
  • Google Play Movies
  • YouTube
  • Fandango At Home

Full details: https://www.themoviedb.org/movie/791155-secret-headquarters/watch?locale=US
```

### 2. Undercover Brother (2002) - TMDB ID 12277 - 5.9/10

An Afro-American organization, the B.R.O.T.H.E.R.H.O.O.D., is in permanent fight against a white organization "The Man" defending the values of the black people in North America. When the Afro-American candidate Gen. Warren Boutwell behaves strangely in his presidential campaign, Undercover Brother is hired to work undercover for "The Man" and find what happened with the potential candidate.

```text
Watch providers for this movie in US:

Available to rent:
  • Amazon Video
  • Apple TV Store
  • Google Play Movies
  • YouTube
  • Fandango At Home

Available to buy:
  • Amazon Video
  • Apple TV Store
  • Google Play Movies
  • YouTube
  • Fandango At Home

Full details: https://www.themoviedb.org/movie/12277-undercover-brother/watch?locale=US
```

### 3. Driving Me Crazy (1991) - TMDB ID 12447 - 3.7/10

An eccentric East German inventor and defector travels to Los Angeles, California to sell a prototype revolutionary new car that runs on vegetables and produces no pollution, but he runs into one madcap situation after another to find a buyer and financier for mass production.

```text
No watch providers found for US. Available countries include:
```

## Re-run Commands

Local stdio MCP:

```bash
npm run build
set -a && source ./.env && set +a && node scripts/now-playing-follow-on-demo.mjs --region US
```

Cloudflare-hosted MCP:

```bash
TMDB_MCP_ACCESS_TOKEN=<your-access-token> node scripts/now-playing-follow-on-demo.mjs --mcp-url https://tmdb-mcp.<your-workers-subdomain>.workers.dev/mcp --region US
```
