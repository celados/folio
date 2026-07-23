---
type: Backlog
title: Folio deferred engineering work
description: Product capabilities intentionally deferred beyond the current static vertical slice.
status: active
---

# Folio deferred engineering work

## Dynamic cloud components and resolver

The static system intentionally resolves installed ESM dependencies through the Host's Vite build.
A future web Agent UI may create remote TSRX component modules, compile them to ESM, and open them
as user-owned cloud documents. Its remote module resolver, authorization, persistence, isolation,
and deployment lifecycle form a separate product layer; they must not leak into the static package
contracts before that demand exists.
