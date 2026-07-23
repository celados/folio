# Folio engineering contract

Folio is a TypeScript monorepo for mounting ordinary Ripple components inside unrelated Host
frameworks. `Notebook` is product language only; engineering symbols use `Component`, `Mount` and
`Shell`.

## Current scope

- Maintain the static Mount and Resource Pipeline vertical slices.
- `packages/core` owns the framework-neutral DOM mount interface and TSRX Shell.
- `packages/react` owns the React lifecycle adapter only.
- `packages/resources` owns author-facing Resource declarations, artifact types, and browser-side
  `ResourceFile` readers.
- `packages/vite` owns Ripple plugin composition, Resource compilation, cache, artifacts, the
  internal DuckDB adapter and build diagnostics.
- `packages/ui` owns explicit reusable TSRX presentation components; it never recreates implicit
  display semantics.
- `examples/world-development` owns the Host-independent acceptance component and Resource.
- `examples/tanstack-start` and `examples/astro` mount that same named component through clean DOM
  boundaries.
- Ripple SSR/hydration, cross-boundary state synchronization, and remote dynamic component
  resolution are deferred.

## Constraints

- Components are ordinary named `.tsrx` exports.
- Resources are ordinary named `*.resource.ts` exports compiled by `@celados/folio-vite`; they never execute
  in the browser.
- Static files enter authored components through Vite asset URLs and `ResourceFile`; Folio does not
  maintain a parallel asset registry or resolver.
- Query text, native drivers, source declarations and absolute paths must not enter client output.
- Resource failures are build failures; never replace them with stale or empty data silently.
- Host adapters own only a stable DOM target and lifecycle cleanup.
- Do not introduce symbols containing `Notebook`.
- Do not interpret, clone, serialize or synchronize `initialProps` fields.
- Use Ripple's native mount, cleanup and `@try`/`@pending`/`@catch` semantics.
- Public packages release together through GitHub Packages; run `packages:pack` and
  `packages:verify` before publication.
- Code comments and runtime messages are English and explain why, not what.
- Use Bun and Vite+ for package management, checks, tests and builds.

## Sources

- Product decisions: [`../docs/authoring-contract.md`](../docs/authoring-contract.md)
- Resource contract: [`../docs/resource-module-contract.md`](../docs/resource-module-contract.md)
- Ripple facts: [`../docs/research/ripple-tsrx-capability-baseline.md`](../docs/research/ripple-tsrx-capability-baseline.md)
- Upstream Ripple docs: https://www.ripple-ts.com/llms.txt
