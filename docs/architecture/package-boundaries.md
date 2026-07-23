---
title: Folio package boundaries and release contract
kind: decision
status: accepted
created: 2026-07-23
updated: 2026-07-23
owners:
  - celados
summary: Freezes the public module seams, Vite-bound source distribution, and coordinated GitHub Packages release contract.
---

# Folio package boundaries and release contract

## Decision

Folio ships five public packages under the GitHub Packages scope owned by the repository organization:

| Package                    | Owns                                                              | Must not own                                            |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| `@celados/folio`           | Framework-neutral Ripple mount lifecycle and Shell boundary       | Host framework adapters, Resource compilation           |
| `@celados/folio-react`     | React DOM-ref and lifecycle adapter                               | Ripple component state or rendering policy              |
| `@celados/folio-resources` | Resource declarations, artifact types, and `ResourceFile` readers | Query execution or Vite hooks                           |
| `@celados/folio-vite`      | TSRX compilation and build-time Resource materialization          | Product UI or runtime SQL                               |
| `@celados/folio-ui`        | Explicit reusable TSRX components for data presentation           | Implicit display semantics or Host-framework components |

Folio is deliberately Vite-bound. Packages containing `.tsrx` are source-first so the consumer's Vite graph
owns component compilation. `@celados/folio-vite` and `@celados/folio-resources` ship compiled ESM plus
declarations because Vite configuration dependencies execute in Node, where TypeScript under `node_modules`
cannot be stripped. A release is accepted only after a clean consumer installed from GitHub Packages completes
a production Vite build.

## Host boundary

A Host owns a stable DOM node and its own lifecycle. It passes one named Ripple component and an initial plain
props record to `mount`. Mount treats the record and every field as opaque; no reactive state contract, UI
component model, or error state crosses the boundary.

React has a package adapter because React owns a distinct lifecycle and renderer identity. Astro uses the
framework-neutral mount API from a small client script; an Astro package would add a seam without new policy.

## Resource delivery

A named `*.resource.ts` export remains an ordinary ESM value to component authors. The Vite plugin performs SQL
and native work only at build time, records provenance, and emits the materialized payload behind an async module
boundary. Importers wait for module evaluation, then receive a synchronous immutable Resource value. Neither SQL
nor DuckDB enters the browser graph.

Ordinary static files use the consumer's Vite asset graph. Authors import a file with `?url`, construct a
`ResourceFile`, and explicitly choose a reader such as `csv`, `arrow`, `parquet`, `zip`, or `xlsx`. This keeps
asset resolution in Vite while `@celados/folio-resources` owns typed decoding and contextual failures.

## Release contract

- All public packages share one version and one `vX.Y.Z` GitHub Release.
- Publishing is triggered only when that GitHub Release is published.
- Authentication uses the workflow `GITHUB_TOKEN`; repository files never contain a token.
- Package tarballs are inspected before publication.
- Publication order follows workspace dependencies.
- The release is incomplete until an isolated consumer installs the exact released versions from
  `https://npm.pkg.github.com` and completes a production build.

## Rejected alternatives

- `@folio/*` is not publishable for this repository because that GitHub Packages scope is not owned by `celados`.
- A single package would mix native build dependencies, Host peers, and browser runtime dependencies.
- Precompiling TSRX component packages would erase the consumer-owned Vite/TSRX contract. Only the packages
  executed by the Vite configuration process are compiled to generic ESM.
- Astro-specific state or component bridges would violate the clean DOM boundary.
