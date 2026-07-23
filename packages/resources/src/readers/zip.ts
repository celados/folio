import type JSZip from 'jszip'

import type { ResourceFileReader, ResourceFileReaderSource } from '../reader.ts'
import { inferResourceFileMimeType } from '../resource-file-metadata.ts'

export type ResourceZipEntry = ResourceFileReaderSource

export type ResourceZipArchive = Readonly<{
  file(path: string): ResourceZipEntry
  filenames: readonly string[]
}>

export const zip: ResourceFileReader<ResourceZipArchive> = async (source) => {
  const buffer = await source.arrayBuffer()
  try {
    const { default: JSZip } = await import('jszip')
    const archive = await JSZip.loadAsync(buffer)
    return Object.freeze(new ResourceZipArchiveValue(archive, source.name))
  } catch (error) {
    throw new Error(`Unable to parse resource file ${JSON.stringify(source.name)} as ZIP`, {
      cause: error,
    })
  }
}

class ResourceZipArchiveValue implements ResourceZipArchive {
  readonly #archive: JSZip
  readonly #resourceName: string
  readonly filenames: readonly string[]

  constructor(archive: JSZip, resourceName: string) {
    this.#archive = archive
    this.#resourceName = resourceName
    this.filenames = Object.freeze(
      Object.values(archive.files)
        .filter((entry) => !entry.dir)
        .map((entry) => entry.name),
    )
  }

  file(path: string): ResourceZipEntry {
    const normalized = `${path}`
    const entry = this.#archive.file(normalized)
    if (entry === null || entry.dir) {
      throw new Error(
        `ZIP entry ${JSON.stringify(normalized)} was not found in resource file ${JSON.stringify(this.#resourceName)}`,
      )
    }
    return Object.freeze(new ResourceZipEntryValue(entry, this.#resourceName))
  }
}

class ResourceZipEntryValue implements ResourceZipEntry {
  readonly #entry: JSZip.JSZipObject
  readonly #resourceName: string
  readonly lastModified: number | undefined
  readonly mimeType: string
  readonly name: string
  readonly size = undefined

  constructor(entry: JSZip.JSZipObject, resourceName: string) {
    this.#entry = entry
    this.#resourceName = resourceName
    this.lastModified = entry.date?.getTime()
    this.mimeType = inferResourceFileMimeType(entry.name)
    this.name = entry.name
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    try {
      return Uint8Array.from(await this.#entry.async('uint8array')).buffer
    } catch (error) {
      throw this.readError('an ArrayBuffer', error)
    }
  }

  async blob(): Promise<Blob> {
    try {
      return new Blob([await this.arrayBuffer()], { type: this.mimeType })
    } catch (error) {
      throw this.readError('a Blob', error)
    }
  }

  async text(encoding?: string): Promise<string> {
    try {
      if (encoding === undefined) return await this.#entry.async('string')
      return new TextDecoder(encoding).decode(await this.arrayBuffer())
    } catch (error) {
      throw this.readError('text', error)
    }
  }

  async json<T = unknown>(): Promise<T> {
    const text = await this.text()
    try {
      return JSON.parse(text) as T
    } catch (error) {
      throw this.readError('JSON', error)
    }
  }

  async stream(): Promise<ReadableStream<Uint8Array<ArrayBufferLike>>> {
    const bytes = new Uint8Array(await this.arrayBuffer())
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    })
  }

  async read<T>(reader: ResourceFileReader<T>): Promise<T> {
    return reader(this)
  }

  private readError(format: string, cause: unknown): Error {
    return new Error(
      `Unable to read ZIP entry ${JSON.stringify(this.name)} from resource file ${JSON.stringify(this.#resourceName)} as ${format}`,
      { cause },
    )
  }
}
