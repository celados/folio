import type { Table as ArrowTable } from 'apache-arrow'
import type { ColumnTable } from 'arquero'

import type { ResourceFileReader, ResourceFileReaderSource } from '../reader.ts'

export type ResourceFileArqueroOptions = Readonly<{
  delimiter?: string
  [name: string]: unknown
}>

export function arquero(options: ResourceFileArqueroOptions = {}): ResourceFileReader<ColumnTable> {
  return (source) => readArquero(source, options)
}

async function readArquero(
  source: ResourceFileReaderSource,
  options: ResourceFileArqueroOptions,
): Promise<ColumnTable> {
  switch (source.mimeType) {
    case 'application/json':
      return convertToArquero(source, 'json', await source.text(), options)
    case 'text/tab-separated-values':
      return convertToArquero(source, 'csv', await source.text(), {
        delimiter: '\t',
        ...options,
      })
    case 'text/csv':
      return convertToArquero(source, 'csv', await source.text(), options)
    default:
      if (/\.arrow$/i.test(source.name)) {
        const { arrow } = await import('./arrow.ts')
        return convertToArquero(source, 'arrow', await source.read(arrow), options)
      }
      if (/\.parquet$/i.test(source.name)) {
        const { parquet } = await import('./parquet.ts')
        return convertToArquero(source, 'arrow', await source.read(parquet), options)
      }
      throw new Error(
        `Unable to determine an Arquero reader for resource file ${JSON.stringify(source.name)} with MIME type ${JSON.stringify(source.mimeType)}`,
      )
  }
}

async function convertToArquero(
  source: ResourceFileReaderSource,
  format: 'arrow' | 'csv' | 'json',
  value: ArrowTable | string,
  options: ResourceFileArqueroOptions,
): Promise<ColumnTable> {
  try {
    const arquero = await import('arquero')
    switch (format) {
      case 'arrow':
        return arquero.fromArrow(
          value as unknown as Parameters<typeof arquero.fromArrow>[0],
          options as Parameters<typeof arquero.fromArrow>[1],
        )
      case 'csv':
        return arquero.fromCSV(value as string, options as Parameters<typeof arquero.fromCSV>[1])
      case 'json':
        return arquero.fromJSON(value as string, options as Parameters<typeof arquero.fromJSON>[1])
    }
  } catch (error) {
    throw new Error(
      `Unable to convert resource file ${JSON.stringify(source.name)} to an Arquero table`,
      { cause: error },
    )
  }
}
