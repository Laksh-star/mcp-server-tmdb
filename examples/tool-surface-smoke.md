# TMDB MCP Tool Surface Smoke

Generated: 2026-05-11T23:23:38.373Z
Mode: local
Server: mcp-server-tmdb
Endpoint: local stdio dist/index.js

## Tool Contract

Expected tools: 19
Actual tools: 19
Unexpected tools: none

```text
advanced_search
compare_movies
find_where_to_watch
get_movie_details
get_now_playing
get_person_details
get_recommendations
get_similar_movies
get_trending
get_trending_tv
get_watch_providers
get_weekend_watchlist
get_weekly_trending_by_language
plan_watch_party
search_by_genre
search_by_keyword
search_movies
search_person
search_tv_shows
```

## Workflow Smoke Results

### compare_movies

```text
Movie comparison (US)
Compared 2 movies by TMDB details and watch-provider availability.

1. The Matrix (1999) - ID: 603
Rating: 8.244/10
Runtime: 136 min
Genres: Action, Science Fiction
Director: Lana Wachowski
Cast: Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss, Hugo Weaving
Rent: Apple TV Store, Google Play Movies, YouTube, Fandango At Home
Buy: Apple TV Store, Google Play Movies, YouTube, Fandango At Home
Best for: Best if you want the strongest TMDB rating.
Overview: Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.

---

2. The Dark Knight (2008) - ID: 155
Rating: 8.53/10
```

### find_where_to_watch

```text
Where to watch (US)
Preferred services: HBO, Netflix

1. The Matrix
Matched: The Matrix (1999) - ID: 603
Rating: 8.244/10
Rent: Apple TV Store, Google Play Movies, YouTube, Fandango At Home, Spectrum On Demand
Buy: Apple TV Store, Google Play Movies, YouTube, Fandango At Home
TMDB watch link: https://www.themoviedb.org/movie/603-the-matrix/watch?locale=US
Preferred service match: none found

2. The Dark Knight
Matched: The Dark Knight (2008) - ID: 155
Rating: 8.53/10
Streaming: HBO Max, HBO Max Amazon Channel
Rent: Amazon Video, Apple TV Store, Google Play Movies, YouTube, Fandango At Home
Buy: Amazon Video, Apple TV Store, Google Play Movies, YouTube, Fandango At Home
TMDB watch link: https://www.themoviedb.org/movie/155-the-dark-knight/watch?locale=US
```

### get_weekend_watchlist

```text
Weekend Watch Concierge picks
Mood: Tense thriller
Country: US
Language: Any language

1. GoodFellas - ID: 769
1990 | 8.5/10 | 145 min | Drama, Crime
Streaming: Amazon Prime Video, Amazon Prime Video with Ads
Why: Fits tense thriller mode; Matches 1 requested service; Strong TMDB rating at 8.5/10
Overview: The true story of Henry Hill, a half-Irish, half-Sicilian Brooklyn kid who is adopted by neighbourhood gangsters at an early age and climbs the ranks of a Mafia family under the guidance of Jimmy Conway.
---
2. The Shawshank Redemption - ID: 278
1994 | 8.7/10 | 142 min | Drama, Crime
Streaming: AMC+ Roku Premium Channel, YouTube TV, AMC
Why: Fits tense thriller mode; Strong TMDB rating at 8.7/10; Streaming in your selected country
Overview: Imprisoned in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison, where he puts his accounting skills to work for an amoral warden. During his long stretch in prison, Dufresne comes to be admired by the other inmates -- including an older prisoner named Red -- for his integrity and unquenchable sense of hope.
---
3. Chinatown - ID: 829
```

### plan_watch_party

```text
Watch Party Planner
Group size: 5
Country: US
Language: Any language
Moods: Crowd pleaser, Tense thriller

Decision:
- Start with Swapped; it has the strongest party-fit score for this group.
- Keep Memento as the safer fallback if availability or mood is off.
- Use Vengeance as the wildcard if the group wants a different flavor.

1. Primary pick: Swapped - ID: 1007757
2026 | 8.9/10 | 102 min | Adventure, Animation, Family
Streaming: Netflix, Netflix Standard with Ads
Party fit: matches 1 requested service; available on subscription streaming; broad group-friendly genre fit
Why: Fits crowd pleaser mode; Matches 1 requested service; Strong TMDB rating at 8.9/10
Overview: A small woodland creature and a majestic bird, two natural sworn enemies of the Valley, magically trade places and set off on an adventure of a lifetime to switch back. Their journey soon uncovers a greater threat—one that could endanger not only their species, but the entire valley they call home.
---
```
