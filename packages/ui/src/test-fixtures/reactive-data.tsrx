import { track } from 'ripple'

import { DataTable } from '../data-table.tsrx'
import { Inspector } from '../inspector.tsrx'
import { Search } from '../search.tsrx'
import type { DataTableColumn } from '../types.ts'

type FixtureRow = Readonly<{ name: string; value: number }>

const FULL_ROWS: readonly FixtureRow[] = [
  { name: 'Alpha', value: 1 },
  { name: 'Beta', value: 2 },
]

const COMPACT_ROWS: readonly FixtureRow[] = [{ name: 'Gamma', value: 3 }]

const FULL_COLUMNS: readonly DataTableColumn<FixtureRow>[] = [
  { key: 'name', label: 'Name', value: 'name' },
  { key: 'value', label: 'Value', value: 'value' },
]

const COMPACT_COLUMNS: readonly DataTableColumn<FixtureRow>[] = [
  { key: 'name', label: 'Place', value: 'name' },
]

export const RICH_HEADER = <abbr title="Municipality">City</abbr>

type ReactiveDataFixtureProps = Readonly<{
  onSearchChange: (rows: readonly FixtureRow[], query: string) => void
}>

export function ReactiveDataFixture(props: ReactiveDataFixtureProps) @{
  let &[compact] = track(false)
  let &[rows] = track(() => (compact ? COMPACT_ROWS : FULL_ROWS))
  let &[columns] = track(() => (compact ? COMPACT_COLUMNS : FULL_COLUMNS))

  <>
    <button data-toggle-data type="button" onClick={() => (compact = !compact)}>Toggle data</button>
    <Search onChange={props.onSearchChange} rows={rows} />
    <DataTable caption="Reactive data" columns={columns} rows={rows} select={false} />
  </>
}

export function ReactiveInspectorFixture() @{
  let &[version] = track(1)
  let &[value] = track(() => ({ alpha: { nested: version } }))

  <>
    <button data-update-inspector type="button" onClick={() => version++}>Update value</button>
    <Inspector expandedDepth={1} label="Reactive value" value={value} />
  </>
}

export function ControlledDataFixture(props: ReactiveDataFixtureProps) @{
  let &[query] = track('')
  let &[selectedKeys] = track<readonly string[]>([])
  let &[sort] = track<
    Readonly<{ column: string; direction: 'ascending' | 'descending' }> | undefined
  >(undefined)

  <>
    <button
      data-update-controls
      type="button"
      onClick={() => {
        query = 'beta'
        selectedKeys = ['Beta']
        sort = { column: 'value', direction: 'descending' }
      }}
    >Update controls</button>
    <Search onChange={props.onSearchChange} query={query} rows={FULL_ROWS} />
    <DataTable
      caption="Controlled data"
      columns={FULL_COLUMNS}
      rowKey={(row: FixtureRow) => row.name}
      rows={FULL_ROWS}
      select="multiple"
      selectedKeys={selectedKeys}
      sort={sort}
    />
  </>
}
