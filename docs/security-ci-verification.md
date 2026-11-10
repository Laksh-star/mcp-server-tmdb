# Dependency and CI verification — 10 November 2026

## Dependency changes

The earlier root production audit reported 19 findings (one critical); the complete
build graph reported 28 (two critical). Updating only the direct MCP SDK would have
left `agents@0.11.4`'s pinned SDK 1.29.0 in the graph. This application used only its
HTTP wrapper, with no Agent or Durable Object, so the wrapper is replaced with the
official SDK's native `WebStandardStreamableHTTPServerTransport`.

Each HTTP request creates its own server and stateless transport. JSON responses
complete before the server is closed; no session or standalone SSE stream is retained.
Existing Streamable HTTP clients still initialize and call all 27 tools. Bearer
authorization applies to MCP data requests; OPTIONS exposes only CORS metadata.

The root lock now uses MCP SDK 1.32.2, Zod 4.6.7, Wrangler 4.159.0, current Worker
types, and patched transitive packages. `shx` moves to 0.4.0. The toolchain requires
Node 22.12+, reflected in the package, doctor, and portable launcher. The Worker
compatibility date remains unchanged.

| Audit scope | Result after update |
| --- | --- |
| Root, including development dependencies (`npm audit`) | 0 known findings |
| Root production (`npm audit --omit=dev`) | 0 known findings |
| Container runtime (`npm audit --omit=dev --prefix docker`) | 0 known findings |

These are dated npm advisory checks, not an operating-system vulnerability scan or
a guarantee that unreported vulnerabilities do not exist.

## Verification

| Check | Evidence |
| --- | --- |
| `npm test` | Concierge, planning, Radar, coverage, doctor, env precedence/redaction, and portable/shell launchers passed. Local MCP workflows passed. |
| `npm run worker:dry-run` | The production Worker bundled with the upgraded toolchain. |
| `npm run test:http` | Actual local Worker passed auth failures, unauthenticated preflight, malformed JSON, 4 MiB body limit, 100-message batch limit, input validation, browser API workflows, 27-tool discovery, and parallel MCP clients. |
| Docker build | Rebuilt the non-root Node 22 image on ARM64. |
| `npm run test:http -- --docker` | The container initialized MCP, listed 27 tools, and called streaming coverage against the local synthetic TMDB service. |
| Actions static checks | `actionlint` 1.7.12 passed both workflows; external action refs were resolved through their owning GitHub repositories and pinned to commit SHAs. |
| Cloudflare version preview | Discovered all 27 tools and successfully called the 12 live workflows against TMDB. The preview upload did not promote production traffic. |

The fixture orchestrator starts/stops its own Worker and TMDB test server on ports
8789 and 8791. It supplies fake credentials and does not call TMDB. The fixture API
is local test infrastructure, not part of the deployed Worker.

The [release guide](releases.md) describes the CI gate and registry publication.
The subsequent [first container release](container-release-verification.md) passed
the release workflow, anonymous pulls and runtime checks for both architectures.
That record also covers verification of the merged Worker in production.
