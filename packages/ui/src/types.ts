export type DataTableColumn<TRow> = Readonly<{
  align?: 'left' | 'right'
  label: string
  value: (row: TRow) => string
}>

export type DataTableProps<TRow> = Readonly<{
  caption: string
  columns: readonly DataTableColumn<TRow>[]
  isSelected?: (row: TRow) => boolean
  onSelect?: (row: TRow) => void
  rowKey: (row: TRow) => string
  rows: readonly TRow[]
}>

export type DownloadButtonProps = Readonly<{
  content: () => BlobPart
  filename: () => string
  label: string
  mediaType: string
}>

export type InspectorProps = Readonly<{
  label: string
  value: unknown
}>

export type StatusPanelProps = Readonly<{
  detail?: string
  kind: 'empty' | 'error' | 'loading'
  title: string
}>
