# TMDB MCP Tool Surface Smoke

Generated: 2026-05-14T01:59:18.255Z
Mode: local
Server: mcp-server-tmdb
Endpoint: local stdio dist/index.js

## Tool Contract

Expected tools: 23
Actual tools: 23
Unexpected tools: none

```text
advanced_search
build_collection_gap_plan
build_franchise_watch_order
build_person_watch_path
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
Rating: 8.5/10
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
Rating: 8.5/10
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

1. Remarkably Bright Creatures - ID: 1330021
2026 | 8.4/10 | 114 min | Drama, Mystery
Streaming: Netflix, Netflix Standard with Ads
Why: Fits tense thriller mode; Matches 1 requested service; Strong TMDB rating at 8.4/10
Overview: Through unlikely bonds formed during night shifts at a local aquarium, Tova, an elderly widow, learns of a life-changing discovery that may bring her joy and wonder once again.
---
2. K-PAX - ID: 167
2001 | 7.2/10 | 120 min | Science Fiction, Drama, Mystery
Streaming: Netflix, Netflix Standard with Ads
Why: Fits tense thriller mode; Matches 1 requested service; Streaming in your selected country
Overview: Prot is a patient at a mental hospital who claims to be from a far away planet. His psychiatrist tries to help him, only to begin to doubt his own explanations.
---
3. The Prestige - ID: 1124
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
- Keep Remarkably Bright Creatures as the safer fallback if availability or mood is off.
- Use Predator: Badlands as the wildcard if the group wants a different flavor.

1. Primary pick: Swapped - ID: 1007757
2026 | 9.0/10 | 102 min | Animation, Family, Adventure
Streaming: Netflix, Netflix Standard with Ads
Party fit: matches 1 requested service; available on subscription streaming; broad group-friendly genre fit
Why: Fits crowd pleaser mode; Matches 1 requested service; Strong TMDB rating at 9.0/10
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

### build_collection_gap_plan

```text
Collection Gap Plan
Query: The Matrix
Collection: The Matrix Collection - ID: 2344
Country: US
Preferred services: Netflix, Prime Video
Completion: 25%
Watched runtime: 2h 16m
Remaining runtime: 6h 55m

Decision:
- 1 of 4 entries are marked watched.
- Next best gap: The Matrix Reloaded.
- 2 missing entries have subscription streaming data for US.

Recommended completion path:
1. The Matrix Reloaded (2003) - ID: 604
Status: missing
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
- Use The Matrix Reloaded as the safer alternate if availability or mood changes.
- Requested services were boosted when TMDB provider data matched.

1. The Creator (2023) - ID: 670292
Rating: 7.0/10 | Runtime: 2h 14m | Score: 155
Genres: Science Fiction, Action, Adventure
Streaming: Netflix, Netflix Standard with Ads
Why it matches: shares 3 liked genres; matches 1 requested service; available on subscription streaming; fits 134 minute runtime
Overview: Amid a future war between the human race and the forces of artificial intelligence, a hardened ex-special forces agent grieving the disappearance of his wife, is recruited to hunt down and kill the Creator, the elusive architect of advanced AI who has developed a mysterious weapon with the power to end the war—and mankind itself.
---
```

### build_person_watch_path

```text
Person Watch Path
Person: Keanu Reeves - ID: 6384
Department: Acting
Country: US

Decision:
- Start with The Matrix; it is the strongest entry point from the scanned credits.
- Use Sonic the Hedgehog 3 if watch-provider availability matters most.

1. Best-rated pick: The Matrix (1999) - ID: 603
Credit: Actor: Neo
Rating: 8.2/10 | Runtime: 2h 16m
Genres: Action, Science Fiction
Rent: Apple TV Store, Google Play Movies, YouTube, Fandango At Home
Why: Highest-rated credible movie credit in this scan.
Overview: Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.
---
2. Available-now pick: Sonic the Hedgehog 3 (2024) - ID: 939243
```
