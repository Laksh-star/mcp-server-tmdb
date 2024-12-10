"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
!/usr/bin / env;
node;
var index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var types_js_1 = require("@modelcontextprotocol/sdk/types.js");
var TMDB_API_KEY = process.env.TMDB_API_KEY;
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var server = new index_js_1.Server({
    name: "example-servers/tmdb",
    version: "0.1.0",
}, {
    capabilities: {
        resources: {},
        tools: {},
    },
});
function fetchFromTMDB(endpoint_1) {
    return __awaiter(this, arguments, void 0, function (endpoint, params) {
        var url, _i, _a, _b, key, value, response;
        if (params === void 0) { params = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    url = new URL("".concat(TMDB_BASE_URL).concat(endpoint));
                    url.searchParams.append("api_key", TMDB_API_KEY);
                    for (_i = 0, _a = Object.entries(params); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], value = _b[1];
                        url.searchParams.append(key, value);
                    }
                    return [4 /*yield*/, fetch(url.toString())];
                case 1:
                    response = _c.sent();
                    if (!response.ok) {
                        throw new Error("TMDB API error: ".concat(response.statusText));
                    }
                    return [2 /*return*/, response.json()];
            }
        });
    });
}
function getMovieDetails(movieId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetchFromTMDB("/movie/".concat(movieId), { append_to_response: "credits,reviews" })];
        });
    });
}
server.setRequestHandler(types_js_1.ListResourcesRequestSchema, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var params, data;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                params = {
                    page: ((_a = request.params) === null || _a === void 0 ? void 0 : _a.cursor) || "1",
                };
                return [4 /*yield*/, fetchFromTMDB("/movie/popular", params)];
            case 1:
                data = _b.sent();
                return [2 /*return*/, {
                        resources: data.results.map(function (movie) { return ({
                            uri: "tmdb:///movie/".concat(movie.id),
                            mimeType: "application/json",
                            name: "".concat(movie.title, " (").concat(movie.release_date.split("-")[0], ")"),
                        }); }),
                        nextCursor: data.page < data.total_pages ? String(data.page + 1) : undefined,
                    }];
        }
    });
}); });
server.setRequestHandler(types_js_1.ReadResourceRequestSchema, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var movieId, movie, movieInfo;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                movieId = request.params.uri.replace("tmdb:///movie/", "");
                return [4 /*yield*/, getMovieDetails(movieId)];
            case 1:
                movie = _b.sent();
                movieInfo = {
                    title: movie.title,
                    releaseDate: movie.release_date,
                    rating: movie.vote_average,
                    overview: movie.overview,
                    genres: (_a = movie.genres) === null || _a === void 0 ? void 0 : _a.map(function (g) { return g.name; }).join(", "),
                    posterUrl: movie.poster_path ?
                        "https://image.tmdb.org/t/p/w500".concat(movie.poster_path) :
                        "No poster available"
                };
                return [2 /*return*/, {
                        contents: [
                            {
                                uri: request.params.uri,
                                mimeType: "application/json",
                                text: JSON.stringify(movieInfo, null, 2),
                            },
                        ],
                    }];
        }
    });
}); });
server.setRequestHandler(types_js_1.ListToolsRequestSchema, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, {
                tools: [
                    {
                        name: "search_movies",
                        description: "Search for movies by title or keywords",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "Search query for movie titles",
                                },
                            },
                            required: ["query"],
                        },
                    },
                    {
                        name: "get_recommendations",
                        description: "Get movie recommendations based on a movie ID",
                        inputSchema: {
                            type: "object",
                            properties: {
                                movieId: {
                                    type: "string",
                                    description: "TMDB movie ID to get recommendations for",
                                },
                            },
                            required: ["movieId"],
                        },
                    },
                    {
                        name: "get_trending",
                        description: "Get trending movies for a time window",
                        inputSchema: {
                            type: "object",
                            properties: {
                                timeWindow: {
                                    type: "string",
                                    enum: ["day", "week"],
                                    description: "Time window for trending movies",
                                },
                            },
                            required: ["timeWindow"],
                        },
                    },
                ],
            }];
    });
}); });
server.setRequestHandler(types_js_1.CallToolRequestSchema, function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, query, data, results, movieId, data, recommendations, timeWindow, data, trending;
    var _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = request.params.name;
                switch (_a) {
                    case "search_movies": return [3 /*break*/, 1];
                    case "get_recommendations": return [3 /*break*/, 3];
                    case "get_trending": return [3 /*break*/, 5];
                }
                return [3 /*break*/, 7];
            case 1:
                query = (_b = request.params.arguments) === null || _b === void 0 ? void 0 : _b.query;
                return [4 /*yield*/, fetchFromTMDB("/search/movie", { query: query })];
            case 2:
                data = _e.sent();
                results = data.results
                    .map(function (movie) {
                    var _a;
                    return "".concat(movie.title, " (").concat((_a = movie.release_date) === null || _a === void 0 ? void 0 : _a.split("-")[0], ") - ID: ").concat(movie.id, "\n") +
                        "Rating: ".concat(movie.vote_average, "/10\n") +
                        "Overview: ".concat(movie.overview, "\n");
                })
                    .join("\n---\n");
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Found ".concat(data.results.length, " movies:\n\n").concat(results),
                            },
                        ],
                        isError: false,
                    }];
            case 3:
                movieId = (_c = request.params.arguments) === null || _c === void 0 ? void 0 : _c.movieId;
                return [4 /*yield*/, fetchFromTMDB("/movie/".concat(movieId, "/recommendations"))];
            case 4:
                data = _e.sent();
                recommendations = data.results
                    .slice(0, 5)
                    .map(function (movie) {
                    var _a;
                    return "".concat(movie.title, " (").concat((_a = movie.release_date) === null || _a === void 0 ? void 0 : _a.split("-")[0], ")\n") +
                        "Rating: ".concat(movie.vote_average, "/10\n") +
                        "Overview: ".concat(movie.overview, "\n");
                })
                    .join("\n---\n");
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Top 5 recommendations:\n\n".concat(recommendations),
                            },
                        ],
                        isError: false,
                    }];
            case 5:
                timeWindow = (_d = request.params.arguments) === null || _d === void 0 ? void 0 : _d.timeWindow;
                return [4 /*yield*/, fetchFromTMDB("/trending/movie/".concat(timeWindow))];
            case 6:
                data = _e.sent();
                trending = data.results
                    .slice(0, 10)
                    .map(function (movie) {
                    var _a;
                    return "".concat(movie.title, " (").concat((_a = movie.release_date) === null || _a === void 0 ? void 0 : _a.split("-")[0], ")\n") +
                        "Rating: ".concat(movie.vote_average, "/10\n") +
                        "Overview: ".concat(movie.overview, "\n");
                })
                    .join("\n---\n");
                return [2 /*return*/, {
                        content: [
                            {
                                type: "text",
                                text: "Trending movies for the ".concat(timeWindow, ":\n\n").concat(trending),
                            },
                        ],
                        isError: false,
                    }];
            case 7: throw new Error("Tool not found");
        }
    });
}); });
// Start the server
if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY environment variable is required");
    process.exit(1);
}
var transport = new stdio_js_1.StdioServerTransport();
server.connect(transport).catch(console.error);
