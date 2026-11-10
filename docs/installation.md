# Installation doctor and Docker

Use Node.js 22+ for a source checkout. The doctor is read-only: it does not change client configuration, install packages, or print credential values.

## Diagnose a checkout

```bash
npm run doctor
npm run doctor -- --online
npm run doctor -- --docker
npm run --silent doctor -- --json
```

The default check covers Node, dependency resolution, source/build freshness, key presence, launcher availability, client references, and an offline MCP handshake/tool listing. It never calls TMDB unless `--online` is supplied. The online check makes one genre-list request and distinguishes rejected credentials from network failures. `--docker` checks the engine without starting it.

Exit code `0` means no failed checks; `1` means at least one failed check. Warnings can describe intentional manual/remote client configuration. The Codex check looks for a reference to this checkout; it is not a full TOML validator. Claude Desktop configuration is checked for readable JSON and a matching checkout reference. The doctor does not prove that a GUI client has restarted or loaded its configuration.

The doctor can inspect another checkout with `--repo /absolute/path/to/checkout`. It still reads the current user's client configurations without changing them.

| Finding | Repair |
| --- | --- |
| Node version too old | Install Node 22+ and check which executable the client launches. The doctor prints the current Node executable path. |
| Dependencies missing | Run `npm ci` or `npm install`. |
| Missing/stale build | Run `npm run build`, then restart the MCP client. |
| Missing/placeholder key | Set `TMDB_API_KEY` in the client's environment or repo `.env`. |
| TMDB rejects the credential | Check the TMDB API key/account access; do not paste the key into an issue. |
| TMDB cannot be reached | Check network, DNS, or the configured `TMDB_BASE_URL`; a connection failure does not establish that the key is invalid. |
| Docker engine stopped | Start Docker Desktop or your configured Docker engine. |
| Client cannot find Node | Use the absolute Node executable path reported by the doctor. |

## Portable Node launcher

The new launcher is `plugins/tmdb/scripts/run-server.mjs`. Existing configurations that use `run-server.sh` still work: the shell wrapper delegates to the Node launcher.

The launcher reads only `TMDB_API_KEY` and `TMDB_BASE_URL` from local env files, with this precedence:

1. Nonempty values already in the client/terminal environment.
2. Repo `.env`.
3. Repo `.tmdb.env` as a fallback.

Files are parsed as data; shell substitutions are not executed. Placeholder/missing keys and missing build output produce stderr diagnostics, preserving stdout for MCP messages. The Node launcher works without Bash; automatic client installation remains the existing macOS workflow.

Example manual client configuration:

```json
{
  "mcpServers": {
    "tmdb": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-tmdb/plugins/tmdb/scripts/run-server.mjs"]
    }
  }
}
```

Use an absolute path to Node in `command` if the GUI client's PATH does not include it. The launcher reads the key from the repo env file, or you can supply it through the client environment. Restart the client after setup changes.

## Build the Docker image

Docker must be installed and its engine running. From the repository root:

```bash
npm run docker:build
npm run smoke:docker
```

Or, without Node/npm on the host:

```bash
docker build -t mcp-server-tmdb:local .
docker run --rm -i -e TMDB_API_KEY mcp-server-tmdb:local
```

Set `TMDB_API_KEY` in the terminal environment first. The Docker command forwards only that variable. A repo `.env` file is not automatically loaded by Docker. If you prefer an env file, create an ignored `.tmdb.env` containing only `TMDB_API_KEY`, then use `--env-file .tmdb.env` at runtime.

This image serves **stdio MCP**. Use `-i` to keep stdin open and omit `-t` to keep the protocol free of terminal formatting. It does not expose an HTTP port or host the browser app; use the [Cloudflare Worker](weekend-watch-concierge.md) for remote MCP/browser hosting.

Example MCP client configuration, after building the local image:

```json
{
  "mcpServers": {
    "tmdb-docker": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "-e", "TMDB_API_KEY", "mcp-server-tmdb:local"],
      "env": { "TMDB_API_KEY": "your_tmdb_api_key" }
    }
  }
}
```

The image runs as the non-root `node` user. Its allowlisted build context includes source/package inputs and excludes local env files, client configs, git history, and artifacts. Credentials are supplied at runtime, not copied into image layers. No image has been published to a registry by this change.

## Container dependency boundary

The TypeScript build uses the root project lockfile. The final stdio image installs from `docker/package.json` and `docker/package-lock.json`, which include only the MCP SDK, Node fetch, and schema library. The Cloudflare `agents` framework is not needed in that image. The container's SDK/schema versions are compatible patches/minor releases locked independently of the existing Worker stack.

On 10 November 2026, `npm audit --omit=dev --prefix docker` reported **zero known advisories** for the container runtime lockfile. This is a dated audit result, not a security guarantee. The existing root production graph reported **19 advisories, including one critical**, and is not upgraded by this change. The critical finding concerned [`proxy-addr` before 2.0.8](https://github.com/advisories/GHSA-jqcg-44mw-7w3h); the root MCP SDK, pinned `agents` SDK, and Zod also have reported findings. Audit output alone does not establish exploitability in this application. A root/Worker dependency upgrade needs its own compatibility review and remains follow-up work.

To reproduce the container runtime audit:

```bash
npm audit --omit=dev --prefix docker
```

## Verification

```bash
npm test
npm run doctor -- --online --docker
npm run docker:build
npm run smoke:docker
```

With the [planning fixture server](planning-verification.md) running, the container can also call the coverage workflow against it on Docker Desktop:

```bash
npm run smoke:docker -- mcp-server-tmdb:local --fixture-base-url http://host.docker.internal:8791
```

The default smoke performs a real stdio handshake and tool discovery without a TMDB request. The optional fixture call exercises the coverage workflow inside the container. Linux hosts may need their own host-gateway address; the Docker Desktop hostname is not assumed portable to every engine.
