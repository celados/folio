# TanStack Start Template

An organization-shared TanStack Start template for Agent Native projects
created with Vite+.

The template starts from shadcn/ui's `b0` TanStack Start preset, uses Base UI,
Tailwind CSS v4, React 19, TypeScript, Bun, and Vite+.

## Create a project

The default branch is the only template source. The template does not publish or
maintain versioned releases.

```bash
vp create github:celados/templates/templates/tanstack-start \
  --package-manager bun \
  --no-agent \
  --editor vscode \
  --hooks \
  --git \
  --no-interactive \
  -- <project-directory>
```

## Develop the template

```bash
vp install
vp dev --port 3000
vp check
vp build
```

The organization Oxfmt baseline lives in `tooling/oxfmt.ts`; `vite.config.ts`
adds TanStack Start's generated-route exclusion and Tailwind stylesheet path.

Cloudflare bindings and runtime types are generated inside the TypeScript
source tree:

```bash
bun run cf-typegen
```

This writes `src/worker-configuration.d.ts`. The template's `check` script also
runs Wrangler in check mode so configuration and generated types cannot drift.

The Agent Native project contract and guidance are maintained as a shared layer
with the Astro template.
