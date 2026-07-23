# Third-party notices

## Observable Notebook Kit

The conservative DSV column type inference; the `ResourceWorkbook` sheet,
range, column, and cell-value extraction algorithms; and the ZIP test fixture
are adapted from Observable Notebook Kit 2.1.8, revision
`7602ed2b9075c2ca0fa0ea21d5549b327dbaa263`.

Copyright 2025 Observable, Inc.

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

## Runtime reader dependencies

The following packages are resolved as normal runtime dependencies and retain
their own license files in their respective distributions:

- Apache Arrow 21.2.0 — Apache-2.0
- Arquero 8.0.3 — BSD-3-Clause
- parquet-wasm 0.7.2 — MIT OR Apache-2.0
- JSZip 3.10.1 — MIT OR GPL-3.0-or-later
- ExcelJS 4.4.0 — MIT

The committed Arrow and Parquet fixtures are generated using Apache Arrow and
parquet-wasm; the generation source is
[`scripts/generate-reader-fixtures.ts`](https://github.com/celados/folio/blob/main/packages/resources/scripts/generate-reader-fixtures.ts).

## d3-dsv

`ResourceFile` uses d3-dsv 3.0.1.

Copyright 2013-2021 Mike Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
