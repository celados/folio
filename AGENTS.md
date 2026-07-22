# Folio engineering contract

Folio is a TypeScript monorepo for mounting ordinary Ripple components inside unrelated Host
frameworks. `Notebook` is product language only; engineering symbols use `Component`, `Mount` and
`Shell`.

## Current scope

- Implement the static client-side Mount vertical slice.
- `packages/core` owns the framework-neutral DOM mount interface and TSRX Shell.
- `packages/react` owns the React lifecycle adapter only.
- `examples/tanstack-start` is the first real Host acceptance app.
- Resource Modules, SSR/hydration, cross-boundary state synchronization and public package
  publication are deferred.

## Constraints

- Components are ordinary named `.tsrx` exports.
- Host adapters own only a stable DOM target and lifecycle cleanup.
- Do not introduce symbols containing `Notebook`.
- Do not interpret, clone, serialize or synchronize `initialProps` fields.
- Use Ripple's native mount, cleanup and `@try`/`@pending`/`@catch` semantics.
- Code comments and runtime messages are English and explain why, not what.
- Use Bun and Vite+ for package management, checks, tests and builds.

## Sources

- Product decisions: [`../docs/authoring-contract.md`](../docs/authoring-contract.md)
- Ripple facts: [`../docs/research/ripple-tsrx-capability-baseline.md`](../docs/research/ripple-tsrx-capability-baseline.md)
- Upstream Ripple docs: https://www.ripple-ts.com/llms.txt
