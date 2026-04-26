#!/usr/bin/env node

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createWeekendConcierge } from "../dist/concierge.js";

const movies = {
  101: {
    id: 101,
    title: "Neon Case",
    release_date: "2024-07-12",
    vote_average: 8.1,
    vote_count: 1800,
    popularity: 82,
    overview: "A detective follows a conspiracy through one long weekend.",
    poster_path: "/neon-case.jpg",
    runtime: 118,
    genres: [
      { id: 53, name: "Thriller" },
      { id: 80, name: "Crime" },
    ],
    credits: {
      crew: [{ name: "Mira Rao", job: "Director" }],
      cast: [
        { name: "Asha Menon", character: "Inspector Devi" },
        { name: "Rohan Shah", character: "Kabir" },
      ],
    },
    "watch/providers": {
      results: {
        IN: {
          link: "https://watch.example/neon-case",
          flatrate: [{ provider_name: "Netflix" }],
          rent: [{ provider_name: "Apple TV" }],
          buy: [],
        },
      },
    },
  },
  202: {
    id: 202,
    title: "Quiet Signal",
    release_date: "2021-04-22",
    vote_average: 7.7,
    vote_count: 920,
    popularity: 45,
    overview: "A journalist traces an encrypted message to a political cover-up.",
    poster_path: "/quiet-signal.jpg",
    runtime: 132,
    genres: [
      { id: 53, name: "Thriller" },
      { id: 9648, name: "Mystery" },
    ],
    credits: {
      crew: [{ name: "Dev Iyer", job: "Director" }],
      cast: [{ name: "Leela Nair", character: "Nisha" }],
    },
    "watch/providers": {
      results: {
        IN: {
          flatrate: [{ provider_name: "Criterion Channel" }],
          rent: [],
          buy: [],
        },
      },
    },
  },
  303: {
    id: 303,
    title: "Long Night Run",
    release_date: "2023-11-03",
    vote_average: 7.4,
    vote_count: 610,
    popularity: 55,
    overview: "A courier has six hours to cross the city with a dangerous package.",
    poster_path: "/long-night-run.jpg",
    runtime: 151,
    genres: [
      { id: 28, name: "Action" },
      { id: 53, name: "Thriller" },
    ],
    credits: {
      crew: [{ name: "Sara Khan", job: "Director" }],
      cast: [{ name: "Kabir Arora", character: "Arjun" }],
    },
    "watch/providers": {
      results: {
        IN: {
          flatrate: [{ provider_name: "Prime Video" }],
          rent: [],
          buy: [],
        },
      },
    },
  },
};

function jsonResponse(response, payload) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function listResponse(ids) {
  return {
    page: 1,
    results: ids.map((id) => {
      const movie = movies[id];
      return {
        id: movie.id,
        title: movie.title,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
        vote_count: movie.vote_count,
        popularity: movie.popularity,
        overview: movie.overview,
        poster_path: movie.poster_path,
        genre_ids: movie.genres.map((genre) => genre.id),
      };
    }),
    total_pages: 1,
  };
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");

  if (url.pathname === "/search/keyword") {
    jsonResponse(response, {
      page: 1,
      results: [{ id: 9090, name: url.searchParams.get("query") || "investigation" }],
      total_pages: 1,
    });
    return;
  }

  if (url.pathname === "/discover/movie") {
    jsonResponse(response, listResponse([101, 202, 303]));
    return;
  }

  if (url.pathname === "/trending/movie/week") {
    jsonResponse(response, listResponse([202, 101]));
    return;
  }

  if (url.pathname === "/movie/now_playing") {
    jsonResponse(response, listResponse([303]));
    return;
  }

  const detailMatch = url.pathname.match(/^\/movie\/(\d+)$/);
  if (detailMatch) {
    const movie = movies[Number(detailMatch[1])];
    if (movie) {
      jsonResponse(response, movie);
      return;
    }
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not found", path: url.pathname }));
});

server.listen(0, "127.0.0.1");
await once(server, "listening");

try {
  const address = server.address();
  assert.equal(typeof address, "object");

  const result = await createWeekendConcierge(
    {
      TMDB_API_KEY: "offline-test-key",
      TMDB_BASE_URL: `http://127.0.0.1:${address.port}`,
    },
    {
      mood: "thriller",
      country: "IN",
      language: "any",
      runtime: "150",
      minRating: "6.5",
      services: ["Netflix"],
    },
  );

  assert.equal(result.country, "IN");
  assert.equal(result.mood, "Tense thriller");
  assert.ok(result.picks.length >= 2, "expected at least two concierge picks");
  assert.equal(result.picks[0].title, "Neon Case");
  assert.deepEqual(result.picks[0].providers.streaming, ["Netflix"]);
  assert.ok(
    result.picks[0].reasons.some((reason) => reason.includes("requested service")),
    "expected the top pick to explain the requested service match",
  );
  assert.ok(
    result.picks.every((pick) => !pick.runtime || pick.runtime <= 150),
    "expected runtime filter to remove titles over 150 minutes",
  );

  console.log("Offline concierge test passed.");
  console.log(`Top pick: ${result.picks[0].title} (${result.picks[0].year})`);
} finally {
  server.close();
}
