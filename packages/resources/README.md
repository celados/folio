# @celados/folio-resources

Typed declarations, artifact contracts, and local-file readers for Folio Resources.

## Common readers

`ResourceFile` accepts a URL, a Vite `?url` import, or an inlined data URL. Its common
readers stay on the value because they add little or no client weight.

```ts
import { ResourceFile } from '@celados/folio-resources'
import citiesUrl from './cities.csv?url'

const file = ResourceFile(citiesUrl)
const rows = await file.csv({ typed: 'auto' })

file.href // synchronous URL; there is intentionally no deprecated url() method
```

The common surface includes `blob`, `arrayBuffer`, `text`, `json`, `stream`, `dsv`,
`csv`, `tsv`, `xml`, `html`, and `image`.

## Advanced readers

Advanced readers use the shared `read(reader)` seam and explicit package subpaths:

```ts
import { ResourceFile } from '@celados/folio-resources'
import { parquet } from '@celados/folio-resources/readers/parquet'
import dataUrl from './measurements.parquet?url'

const table = await ResourceFile(dataUrl).read(parquet)
```

Available reader entries are:

- `@celados/folio-resources/readers/arrow`
- `@celados/folio-resources/readers/arquero`
- `@celados/folio-resources/readers/parquet`
- `@celados/folio-resources/readers/xlsx`
- `@celados/folio-resources/readers/zip`

There is deliberately no readers barrel. A directly used reader enters the static Vite
client graph only when its subpath is imported; Arquero's format adapters stay behind
dynamic format branches.

Readers compose across resource containers. A ZIP entry implements the same reader
source contract as `ResourceFile`, so nested formats do not require format-specific ZIP
methods:

```ts
import { ResourceFile } from '@celados/folio-resources'
import { xlsx } from '@celados/folio-resources/readers/xlsx'
import { zip } from '@celados/folio-resources/readers/zip'
import archiveUrl from './archive.zip?url'

const archive = await ResourceFile(archiveUrl).read(zip)
const workbook = await archive.file('report.xlsx').read(xlsx)
```

Arquero is a reader factory because its parser options vary per use:

```ts
import { ResourceFile } from '@celados/folio-resources'
import { arquero } from '@celados/folio-resources/readers/arquero'
import dataUrl from './data.json?url'

const table = await ResourceFile(dataUrl).read(arquero({ autoType: false }))
```

The Arquero reader loads its Arrow or Parquet adapter only after detecting that
source format. CSV and JSON paths therefore load Arquero without loading Apache
Arrow, Parquet, or the Parquet WASM module.
