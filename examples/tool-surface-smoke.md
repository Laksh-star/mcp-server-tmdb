# TMDB MCP Tool Surface Smoke

Generated: 2026-05-12T00:18:16.750Z
Mode: local
Server: mcp-server-tmdb
Endpoint: local stdio dist/index.js

## Tool Contract

Expected tools: 21
Actual tools: 21
Unexpected tools: none

```text
advanced_search
build_franchise_watch_order
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
recommend_from_taste_profile
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
Rating: 8.2/10
Rent: Apple TV Store, Google Play Movies, YouTube, Fandango At Home, Spectrum On Demand
Buy: Apple TV Store, Google Play Movies, YouTube, Fandango At Home
TMDB watch link: https://www.themoviedb.org/movie/603-the-matrix/watch?locale=US
Preferred service match: none found

2. The Dark Knight
Matched: The Dark Knight (2008) - ID: 155
Rating: 8.53/10
No watch providers found for US.
Preferred service match: none found

Quick decision
```

### get_weekend_watchlist

```text
Weekend Watch Concierge picks
Mood: Tense thriller
Country: US
Language: Any language

1. Memento - ID: 77
2000 | 8.2/10 | 113 min | Mystery, Thriller
Streaming: Amazon Prime Video, HBO Max, Peacock Premium, Cinemax Amazon Channel, Cinemax Apple TV Channel, Amazon Prime Video with Ads, Peacock Premium Plus
Why: Fits tense thriller mode; Matches 1 requested service; Strong TMDB rating at 8.2/10
Overview: Leonard Shelby is tracking down the man who raped and murdered his wife. The difficulty of locating his wife's killer, however, is compounded by the fact that he suffers from a rare, untreatable form of short-term memory loss. Although he can recall details of life before his accident, Leonard cannot remember what happened fifteen minutes ago, where he's going, or why.
---
2. GoodFellas - ID: 769
1990 | 8.5/10 | 145 min | Drama, Crime
Streaming: Amazon Prime Video, Amazon Prime Video with Ads
Why: Fits tense thriller mode; Matches 1 requested service; Strong TMDB rating at 8.5/10
Overview: The true story of Henry Hill, a half-Irish, half-Sicilian Brooklyn kid who is adopted by neighbourhood gangsters at an early age and climbs the ranks of a Mafia family under the guidance of Jimmy Conway.
---
3. Se7en - ID: 807
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

### build_franchise_watch_order

```text
Franchise Watch Guide
Query: The Matrix
Collection: The Matrix Collection - ID: 2344
Country: US
Total runtime: 9h 11m

Decision:
- Start with The Matrix; release order is the clearest default for this franchise.
- 2 of 4 entries have subscription streaming data for US.

Release order:
1. The Matrix (1999) - ID: 603
Rating: 8.2/10 | Runtime: 2h 16m
Rent: Apple TV Store, Google Play Movies, YouTube, Fandango At Home
Note: Start here for release-order context.
---
2. The Matrix Reloaded (2003) - ID: 604
Rating: 7.1/10 | Runtime: 2h 18m
```

### recommend_from_taste_profile

```text
Taste Profile Recommendations
Liked: The Matrix, Inception
Disliked: The Notebook
Country: US
Language: any

Decision:
- Start with The Creator; it has the strongest taste-fit score.
- Use Terminator 2: Judgment Day as the safer alternate if availability or mood changes.
- Requested services were boosted when TMDB provider data matched.

1. The Creator (2023) - ID: 670292
Rating: 7.0/10 | Runtime: 2h 14m | Score: 155
Genres: Science Fiction, Action, Adventure
Streaming: Netflix, Netflix Standard with Ads
Why it matches: shares 3 liked genres; matches 1 requested service; available on subscription streaming; fits 134 minute runtime
Overview: Amid a future war between the human race and the forces of artificial intelligence, a hardened ex-special forces agent grieving the disappearance of his wife, is recruited to hunt down and kill the Creator, the elusive architect of advanced AI who has developed a mysterious weapon with the power to end the war—and mankind itself.
---
```
