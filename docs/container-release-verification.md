# First container release — 10 November 2026

Release: [watch-planning-2026-11-10](https://github.com/Laksh-star/screenward/releases/tag/watch-planning-2026-11-10)
from merged commit `249190f2bc6653c0a3e23f84230f7d400be694de`.

[Main CI](https://github.com/Laksh-star/screenward/actions/runs/42800797242)
passed, then the [release workflow](https://github.com/Laksh-star/screenward/actions/runs/42801027292)
reran Node 22/24 verification and successfully published both architectures.

## Published artifact

- Package: [mcp-server-tmdb on GHCR](https://github.com/Laksh-star/screenward/pkgs/container/mcp-server-tmdb), visibly public at verification time.
- Release tag: `ghcr.io/laksh-star/mcp-server-tmdb:watch-planning-2026-11-10`.
- Commit tag: `sha-249190f2bc6653c0a3e23f84230f7d400be694de`.
- `latest`, the release tag, and the commit tag all resolved to the same manifest digest when checked.

For a fixed artifact, pull by the multi-platform index digest:

```bash
docker pull ghcr.io/laksh-star/mcp-server-tmdb@sha256:8457118833126e148f9dd9657e12da9b822edb3708982146cadeac133f041122
```

| Platform | Platform manifest digest |
| --- | --- |
| `linux/amd64` | `sha256:3e9e73cf2581754a991af5e560dd075889787b2adf468358c1513998c57eb36a` |
| `linux/arm64` | `sha256:aa2fb669d37ede7b970ffccab8926507b636dc78c649b15cfb5dbdd6ece75b5c` |

The raw registry index contains two additional attestation manifests. Their layer
annotations identify SPDX SBOM and SLSA provenance v1 predicates for each platform.
These are BuildKit registry artifacts; no GitHub artifact attestation or external
signature verification is claimed.

## Checks against the published images

Both platform manifests were pulled with a temporary Docker configuration containing
an empty `auths` object, without a credential store or registry login. The anonymous
registry response was also hashed and matched the index digest above.

Each image was run explicitly with its platform and verified to:

- Execute as UID 1000 with Node reporting the expected architecture.
- Contain MCP SDK 1.32.2 and Zod 4.6.7, with no `/app/.env` or `/app/.git`.
- Complete a real SDK stdio handshake and list all 27 tools.
- Call `plan_streaming_coverage` against a local synthetic TMDB service, correctly
  checking two movie/TV entries and finding both covered by Netflix.

ARM64 ran natively on Docker Desktop; amd64 ran under emulation on the same machine.
The local fixture was stopped after the checks. No real TMDB credential was passed
to these containers. These runtime checks are not a base-image vulnerability scan.

## Production Worker

The merged Worker was deployed separately. Its production endpoint passed discovery
of all 27 tools and the twelve live workflow calls: comparison, availability, solo,
party, franchise, collection gaps, taste, person path, release calendar, TV binge,
availability Radar, and streaming coverage. The endpoint and access token are
deployment-specific and are not included in this public record.

## Publisher maintenance follow-up

The first publication passed with the original pinned Docker actions; GitHub noted
their Node 20 runtime declarations and ran them under Node 24. The follow-up pins
Docker QEMU/Buildx/login/metadata/build-push actions to releases declaring native
Node 24. Action metadata and input compatibility are checked statically; a future
release will exercise those new action revisions in the publisher job.
