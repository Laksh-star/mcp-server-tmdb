# TMDB MCP Tool Surface Smoke

Generated: 2026-04-26T06:30:17.320Z
Mode: local
Server: mcp-server-tmdb
Endpoint: local stdio dist/index.js

## Tool Contract

Expected tools: 18
Actual tools: 18
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
Rating: 8.242/10
Runtime: 136 min
Genres: Action, Science Fiction
Director: Lana Wachowski
Cast: Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss, Hugo Weaving
Streaming: YouTube TV
Rent: Apple TV Store, Google Play Movies, YouTube, Fandango At Home
Buy: Apple TV Store, Google Play Movies, YouTube, Fandango At Home
Best for: Best if you want something available on subscription streaming.
Overview: Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.

---

2. The Dark Knight (2008) - ID: 155
```

### find_where_to_watch

```text
Where to watch (US)
Preferred services: HBO, Netflix

1. The Matrix
Matched: The Matrix (1999) - ID: 603
Rating: 8.242/10
Streaming: YouTube TV
Rent: Apple TV Store, Google Play Movies, YouTube, Fandango At Home, Spectrum On Demand
Buy: Apple TV Store, Google Play Movies, YouTube, Fandango At Home
TMDB watch link: https://www.themoviedb.org/movie/603-the-matrix/watch?locale=US
Preferred service match: none found

2. The Dark Knight
Matched: The Dark Knight (2008) - ID: 155
Rating: 8.528/10
Streaming: HBO Max, HBO Max Amazon Channel
Rent: Amazon Video, Apple TV Store, Google Play Movies, YouTube, Fandango At Home
Buy: Amazon Video, Apple TV Store, Google Play Movies, YouTube, Fandango At Home
```

### get_weekend_watchlist

```text
Weekend Watch Concierge picks
Mood: Tense thriller
Country: US
Language: Any language

1. The Silence of the Lambs - ID: 274
1991 | 8.3/10 | 119 min | Crime, Thriller, Drama
Streaming: Amazon Prime Video, AMC Plus Apple TV Channel , AMC+ Amazon Channel, YouTube TV, AMC, MGM Plus, Philo, Amazon Prime Video with Ads
Why: Fits tense thriller mode; Matches 1 requested service; Strong TMDB rating at 8.3/10
Overview: Clarice Starling is a top student at the FBI's training academy.  Jack Crawford wants Clarice to interview Dr. Hannibal Lecter, a brilliant psychiatrist who is also a violent psychopath, serving life behind bars for various acts of murder and cannibalism.  Crawford believes that Lecter may have insight into a case and that Starling, as an attractive young woman, may be just the bait to draw him out.
---
2. Memento - ID: 77
2000 | 8.2/10 | 113 min | Mystery, Thriller
Streaming: Amazon Prime Video, HBO Max, Peacock Premium, Cinemax Amazon Channel, Cinemax Apple TV Channel, Amazon Prime Video with Ads, Peacock Premium Plus
Why: Fits tense thriller mode; Matches 1 requested service; Strong TMDB rating at 8.2/10
Overview: Leonard Shelby is tracking down the man who raped and murdered his wife. The difficulty of locating his wife's killer, however, is compounded by the fact that he suffers from a rare, untreatable form of short-term memory loss. Although he can recall details of life before his accident, Leonard cannot remember what happened fifteen minutes ago, where he's going, or why.
---
3. Witness for the Prosecution - ID: 37257
```
