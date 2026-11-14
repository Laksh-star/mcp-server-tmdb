# Container releases

Published: [Watch Planning & Containers — 10 November 2026](https://github.com/Laksh-star/screenward/releases/tag/watch-planning-2026-11-10).
The [public GHCR package](https://github.com/Laksh-star/screenward/pkgs/container/mcp-server-tmdb)
supports `linux/amd64` and `linux/arm64`. Both architectures passed anonymous pull,
non-root execution, 27-tool discovery, and a fixture workflow call. See the
[release verification record](container-release-verification.md) for exact digests.

## Maintainer sequence

1. Merge the reviewed change and confirm the `CI` workflow passes on `main`.
2. Publish a GitHub release with a new tag targeting the intended full commit SHA.
   A dated tag such as `watch-planning-YYYY-MM-DD` works; this workflow does not
   require changing the npm package version or MCP protocol metadata.
3. Follow `Publish container` in Actions. It reruns CI against the release tag,
   then builds and pushes identical images to `ghcr.io/laksh-star/screenward`
   and the compatible `ghcr.io/laksh-star/mcp-server-tmdb` address for `linux/amd64`
   and `linux/arm64` using the repository's `GITHUB_TOKEN`. The publisher guard uses
   the immutable repository ID, so a repository rename does not disable publishing.
4. Check the package's visibility. If needed, set this open-source package to public
   in its package settings, then verify an unauthenticated pull before announcing it.
5. Pull the release tag, run the stdio smoke below, and record the returned digest
   in the release notes. Check the image manifest contains both architectures.

The publication has three tag forms: the GitHub release tag (normalized by Docker's
metadata action), `sha-<full-commit-sha>`, and `latest` for a non-prerelease. Prereleases
never move `latest`. Prefer the returned `sha256` digest for a fixed deployment;
tags can be moved by maintainers.

No Cloudflare token or TMDB key is needed by CI or publishing. Pull requests receive
a read-only repository token. Only the release publisher job has `packages: write`.
The actions are pinned to reviewed commit SHAs. BuildKit attaches provenance and an
SBOM; these are registry artifacts, not GitHub artifact attestations.

GitHub reference: [publishing packages with Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
and [container registry visibility](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Use a published image

The first published tag is `watch-planning-2026-11-10`. For subsequent releases,
substitute the exact tag shown by Actions:

```bash
docker pull ghcr.io/laksh-star/mcp-server-tmdb:watch-planning-2026-11-10
npm run smoke:docker -- ghcr.io/laksh-star/mcp-server-tmdb:watch-planning-2026-11-10
docker buildx imagetools inspect ghcr.io/laksh-star/mcp-server-tmdb:watch-planning-2026-11-10
```

The smoke checks non-root execution, MCP initialization, and discovery of all 27 tools
without calling TMDB. For real tool calls, supply your own API key at runtime:

```bash
docker run --rm -i -e TMDB_API_KEY ghcr.io/laksh-star/mcp-server-tmdb:watch-planning-2026-11-10
```

Set `TMDB_API_KEY` in the calling terminal or MCP client environment first. Keep `-i`
and omit `-t`. The container serves stdio MCP; the browser app and HTTP transport
remain Cloudflare deployments. Publishing an image does not deploy the Worker.

## Checks before publication

`CI` runs on pull requests, pushes to `main`, and as a reusable release prerequisite.
Node 22 and 24 each run the offline tests, npm audits, Worker bundle, and authenticated
HTTP/MCP fixture checks. Node 22 also builds the Docker image and calls a workflow
inside it against a local fixture. High or critical npm findings stop CI.

Run the same checks locally with Node 22.12+ and a running Docker engine:

```bash
npm ci --ignore-scripts
npm test
npm audit --audit-level=high
npm audit --omit=dev --prefix docker --audit-level=high
npm run worker:dry-run
npm run docker:build
npm run test:http -- --docker
```
