# Folio TanStack Start acceptance app

This app proves that a named Ripple component can live in an unrelated TanStack Start project,
import a build-time Folio Resource, and own a substantial interactive document behind one stable
React DOM mount.

`WorldDevelopmentReport` rebuilds interaction patterns from four official Observable/D3 notebooks
without an iframe or Observable runtime:

- Wealth & Health of Nations: animated Gapminder data with sparse-series interpolation.
- Brushable Scatterplot: cohort selection feeding summary metrics and a table.
- Zoomable Treemap: region-to-country population drill-down.
- Line with Tooltip: exact historical values and click-to-set-year linkage.

The 180-country attachment is compiled by DuckDB through `@celados/folio-vite`; SQL, the native driver and
source path remain build-only.

## Run locally

```bash
vp install
vp dev --port 3000
```

## Verify

```bash
vp check
vp test --run
vp build
```

The complete provenance and interaction matrix lives in
[`../../../docs/example-acceptance.md`](../../../docs/example-acceptance.md).
