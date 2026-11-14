# Screenward — rename and compatibility

Screenward is the new product name for `mcp-server-tmdb`. The same repository now
describes the broader movie/TV browser app, watch planning, saved watchlists,
streaming coverage, availability Radar, and 27 MCP tools.

Canonical repository: [Laksh-star/screenward](https://github.com/Laksh-star/screenward).
The existing repository is renamed, preserving its history, issues, releases, stars,
and forks. GitHub redirects the old repository and Git URLs; do not create a new
repository at the old path, which would replace that redirect. See
[GitHub's rename guidance](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository).

## Existing checkouts

Your local folder does not need to change. In your existing checkout, update the remote:

```bash
git remote set-url origin https://github.com/Laksh-star/screenward.git
git pull --ff-only
npm install
npm run doctor
```

Use the branch you normally update; do not switch a feature branch merely for the
rename. Existing client configs contain absolute local paths: moving or renaming
the checkout folder requires updating those paths. The repo installer is optional
and changes client configuration; run it only if you intend to refresh those entries.

New clones use:

```bash
git clone https://github.com/Laksh-star/screenward.git
cd screenward
npm install
```

## Compatibility surface

| Surface | Rename behavior |
| --- | --- |
| Browser app and plugin display name | Screenward. Concierge, Watch Party, Planning Lab, and Radar remain feature labels. |
| npm package and CLI | `mcp-server-tmdb` remains the package and executable name. No `npx screenward` package is published by this rename. |
| Plugin directory and ID | `plugins/tmdb` and `tmdb` stay unchanged. |
| Client identifiers | Existing `tmdb`, `tmdb-local`, `tmdb_local`, installer markers, and MCP server identities remain supported. |
| Tools and resources | All 27 tool names, argument schemas, and `tmdb:///movie/<id>` resource URIs stay unchanged. |
| Credentials/config | `TMDB_API_KEY`, `TMDB_BASE_URL`, and `ACCESS_TOKEN` retain their meanings. |
| Cloudflare | The `tmdb-mcp` Worker name, `/mcp` route, and deployed address remain unchanged. |
| Browser data | Existing watchlist, per-country Radar, preferences, and session-token storage keys remain unchanged. |
| Docker | The legacy image remains available. New releases publish identical images under both names. |

The updated plugin display name appears after refreshing the installed plugin cache
and restarting the client. The rename does not automatically rewrite user client configs.

## Docker transition

The existing published artifact remains available without a registry login:

```bash
docker run --rm -i -e TMDB_API_KEY ghcr.io/laksh-star/mcp-server-tmdb:watch-planning-2026-11-10
```

Subsequent release workflows publish the same multi-platform image under:

```text
ghcr.io/laksh-star/screenward:<release-tag>
ghcr.io/laksh-star/mcp-server-tmdb:<release-tag>
```

Keep the legacy name until you choose to adopt a verified Screenward tag or digest.
Old release tags/digests remain historical artifacts; they are not rewritten by the
product rename. OCI source links and GitHub badges use the new canonical repository.

## Browser data and deployment

The existing Worker address stays in place, preserving the browser origin used by
saved lists and Radar baselines. A future domain move would use different browser
storage: export/import guidance would be needed for saved watchlists, and Radar
baselines would need a separate migration. Watchlist JSON exports currently contain
saved entries, not Radar snapshots. This rebrand does not move the domain.

## Maintainer verification

Run the offline tests, authenticated HTTP fixtures, Worker bundle, and Docker smoke.
Check a narrow browser layout and reload an existing saved list on the same origin.
After the repository rename, verify old URL redirects, CI, package linkage, and
release publishing. The publishing guard uses repository ID `901420381`, rather
than the old repository name; forks retain read-only CI and cannot publish here.
