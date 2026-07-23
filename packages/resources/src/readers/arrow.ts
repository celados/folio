import type { Table as ArrowTable } from 'apache-arrow'

import type { ResourceFileReader } from '../reader.ts'

export const arrow: ResourceFileReader<ArrowTable> = async (source) => {
  const buffer = await source.arrayBuffer()
  try {
    const { tableFromIPC } = await import('apache-arrow')
    return tableFromIPC(buffer)
  } catch (error) {
    throw new Error(`Unable to parse resource file ${JSON.stringify(source.name)} as Arrow IPC`, {
      cause: error,
    })
  }
}
