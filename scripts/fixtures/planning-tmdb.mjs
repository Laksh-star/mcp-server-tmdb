/** Deterministic upstream for browser/API verification; no TMDB credentials needed. */
import { createServer } from "node:http";
const day = new Date().toISOString().slice(0, 10);
const provider = { results: { US: { flatrate: [{ provider_name: "Netflix" }], rent: [{ provider_name: "Apple TV Store" }], link: "https://www.themoviedb.org/movie/101/watch?locale=US" }, IN: { flatrate: [{ provider_name: "Netflix" }] } } };
const movies = [
  { id: 101, title: "Neon Case", runtime: 100, release_date: day, original_language: "en", vote_average: 8.2, vote_count: 1500, popularity: 50, overview: "A detective follows a missing film reel.", genres: [{ id: 28, name: "Action" }, { id: 9648, name: "Mystery" }] },
  { id: 102, title: "Quiet Orbit", runtime: 110, release_date: day, original_language: "en", vote_average: 7.8, vote_count: 1200, popularity: 30, overview: "Two astronauts reconnect with home.", genres: [{ id: 28, name: "Action" }] },
  { id: 103, title: "Sunday Train", runtime: 90, release_date: day, original_language: "en", vote_average: 7.5, vote_count: 700, popularity: 20, overview: "Friends travel to an unexpected reunion.", genres: [{ id: 35, name: "Comedy" }] },
].map((movie) => ({ ...movie, "watch/providers": provider, credits: { crew: [{ name: "A Director", job: "Director" }], cast: [{ name: "An Actor", character: "Detective" }] } }));
const shows = [
  { id: 101, name: "Short Mystery", status: "Ended", number_of_episodes: 6, episode_run_time: [45] },
  { id: 202, name: "Unknown Runtime", status: "Ended", number_of_episodes: 4, episode_run_time: [] },
  { id: 303, name: "Cancelled Mystery", status: "Canceled", number_of_episodes: 6, episode_run_time: [45] },
].map((show) => ({ ...show, number_of_seasons: 1, first_air_date: "2024-01-01", original_language: "en", vote_average: 8.2, vote_count: 800, genres: [{ id: 9648, name: "Mystery" }], "watch/providers": provider }));
const list = (results) => ({ page: 1, total_pages: 1, results });
export function createPlanningFixture() {
  return createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    let payload;
    if (url.pathname === "/genre/movie/list") payload = { genres: [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" }, { id: 9648, name: "Mystery" }] };
    if (url.pathname === "/genre/tv/list") payload = { genres: [{ id: 80, name: "Crime" }, { id: 9648, name: "Mystery" }] };
    if (["/discover/movie", "/trending/movie/week", "/movie/now_playing"].includes(url.pathname)) payload = list(movies);
    if (url.pathname === "/discover/tv") payload = list(shows);
    if (url.pathname === "/search/keyword") payload = list([{ id: 9, name: "mystery" }]);
    if (url.pathname === "/search/movie") payload = list(movies.filter((movie) => movie.title.toLowerCase().includes((url.searchParams.get("query") || "").toLowerCase())));
    const movieMatch = url.pathname.match(/^\/movie\/(\d+)(?:\/(recommendations|similar))?$/);
    if (movieMatch) payload = movieMatch[2] ? list(movies.filter((movie) => movie.id !== Number(movieMatch[1]))) : movies.find((movie) => movie.id === Number(movieMatch[1]));
    const showMatch = url.pathname.match(/^\/tv\/(\d+)$/);
    if (showMatch) payload = shows.find((show) => show.id === Number(showMatch[1]));
    response.writeHead(payload ? 200 : 404, { "content-type": "application/json" });
    response.end(JSON.stringify(payload || { error: "Unknown fixture route" }));
  });
}
if (process.argv.includes("--serve")) createPlanningFixture().listen(8791, "127.0.0.1", () => console.log("Deterministic TMDB fixture on http://127.0.0.1:8791"));
