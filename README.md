# Folio

Folio mounts ordinary Ripple components into unrelated Host frameworks through a small DOM and
lifecycle interface.

The static vertical slice contains a framework-neutral core, a React adapter, a build-time Resource
Pipeline, explicit TSRX UI components, and TanStack Start plus Astro acceptance hosts. Both hosts
mount the same named `WorldDevelopmentReport` component and materialized Resource.

```ts
// src/resources/world-development.resource.ts
import { defineSqlResource } from '@celados/folio-resources'

export const worldDevelopment = defineSqlResource<NationHistory>({
  adapter: 'duckdb',
  inputs: { nations: './world-development/nations.json' },
  query: 'select name, region, income, population from nations order by name',
})
```

`@celados/folio-vite` compiles this declaration to a named ESM `Resource<T>` export. Components import
`worldDevelopment.data` normally; DuckDB, SQL execution, input files and cache machinery stay in
the build process. Materialized payloads are emitted as separate lazy chunks rather than inflating
the importing component chunk.

The acceptance app migrates four official Observable/D3 examples into one ordinary named TSRX
component. It includes 209-year animation, a brush-linked scatterplot, a zoomable population
treemap, a pointer-driven history chart, filters, reusable table/search/download/inspection
components, and browser-side `ResourceFile` readers over ordinary Vite asset URLs.

```bash
vp install
bun run packages:build
bun run capabilities:check
bun run check
bun run typecheck
bun run test
bun run build
bun run test:e2e
bun run test:hmr
bun run packages:pack
bun run packages:verify
```

Package boundaries and the GitHub Packages contract are frozen in
[`docs/architecture/package-boundaries.md`](docs/architecture/package-boundaries.md).
