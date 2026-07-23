import {
  parseResourceFileDsv,
  type ResourceFileDsvArrayOptions,
  type ResourceFileDsvArrayResult,
  type ResourceFileDsvObjectOptions,
  type ResourceFileDsvObjectResult,
  type ResourceFileDsvOptions,
  type ResourceFileDsvResult,
} from './resource-file-dsv.ts'
import { inferResourceFileMimeType } from './resource-file-metadata.ts'
import type { ResourceFileReader } from './reader.ts'

export type {
  ResourceFileDsvArrayResult,
  ResourceFileDsvArrayOptions,
  ResourceFileDsvObjectResult,
  ResourceFileDsvObjectOptions,
  ResourceFileDsvOptions,
  ResourceFileDsvResult,
} from './resource-file-dsv.ts'
export type ResourceFileMetadata = Readonly<{
  base?: string | URL
  lastModified?: number
  mimeType?: string
  name?: string
  size?: number
}>

export type ResourceFile = Readonly<{
  arrayBuffer(): Promise<ArrayBuffer>
  blob(): Promise<Blob>
  csv(options: Omit<ResourceFileDsvArrayOptions, 'delimiter'>): Promise<ResourceFileDsvArrayResult>
  csv(
    options?: Omit<ResourceFileDsvObjectOptions, 'delimiter'>,
  ): Promise<ResourceFileDsvObjectResult>
  csv(options: Omit<ResourceFileDsvOptions, 'delimiter'>): Promise<ResourceFileDsvResult>
  dsv(options: ResourceFileDsvArrayOptions): Promise<ResourceFileDsvArrayResult>
  dsv(options?: ResourceFileDsvObjectOptions): Promise<ResourceFileDsvObjectResult>
  dsv(options: ResourceFileDsvOptions): Promise<ResourceFileDsvResult>
  href: string
  html(): Promise<Document>
  image(properties?: Partial<HTMLImageElement>): Promise<HTMLImageElement>
  json<T = unknown>(): Promise<T>
  lastModified: number | undefined
  mimeType: string
  name: string
  read<T>(reader: ResourceFileReader<T>): Promise<T>
  size: number | undefined
  stream(): Promise<ReadableStream<Uint8Array<ArrayBufferLike>>>
  text(encoding?: string): Promise<string>
  tsv(options: Omit<ResourceFileDsvArrayOptions, 'delimiter'>): Promise<ResourceFileDsvArrayResult>
  tsv(
    options?: Omit<ResourceFileDsvObjectOptions, 'delimiter'>,
  ): Promise<ResourceFileDsvObjectResult>
  tsv(options: Omit<ResourceFileDsvOptions, 'delimiter'>): Promise<ResourceFileDsvResult>
  xml(mimeType?: DOMParserSupportedType): Promise<Document>
}>

export function ResourceFile(
  source: string | URL,
  metadata: ResourceFileMetadata = {},
): ResourceFile {
  const href = resolveHref(source, metadata.base)
  const name = metadata.name ?? inferName(href)
  const mimeType = metadata.mimeType ?? inferResourceFileMimeType(name, href)

  requireText(name, 'Resource file name')
  requireText(mimeType, 'Resource file MIME type')
  requireMetadataNumber(metadata.size, 'Resource file size')
  requireMetadataNumber(metadata.lastModified, 'Resource file lastModified')

  return Object.freeze(
    new ResourceFileValue(href, name, mimeType, metadata.lastModified, metadata.size),
  )
}

class ResourceFileValue implements ResourceFile {
  readonly href: string
  readonly lastModified: number | undefined
  readonly mimeType: string
  readonly name: string
  readonly size: number | undefined

  constructor(
    href: string,
    name: string,
    mimeType: string,
    lastModified: number | undefined,
    size: number | undefined,
  ) {
    this.href = href
    this.lastModified = lastModified
    this.mimeType = mimeType
    this.name = name
    this.size = size
  }

  async blob(): Promise<Blob> {
    const response = await this.fetch()
    try {
      return await response.blob()
    } catch (error) {
      throw new Error(`Unable to read resource file ${JSON.stringify(this.name)} as a Blob`, {
        cause: error,
      })
    }
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const response = await this.fetch()
    try {
      return await response.arrayBuffer()
    } catch (error) {
      throw new Error(
        `Unable to read resource file ${JSON.stringify(this.name)} as an ArrayBuffer`,
        { cause: error },
      )
    }
  }

  async text(encoding?: string): Promise<string> {
    if (encoding === undefined) {
      const response = await this.fetch()
      try {
        return await response.text()
      } catch (error) {
        throw new Error(`Unable to read resource file ${JSON.stringify(this.name)} as text`, {
          cause: error,
        })
      }
    }

    const buffer = await this.arrayBuffer()
    try {
      return new TextDecoder(encoding).decode(buffer)
    } catch (error) {
      throw new Error(
        `Unable to decode resource file ${JSON.stringify(this.name)} using ${JSON.stringify(encoding)}`,
        { cause: error },
      )
    }
  }

  async json<T = unknown>(): Promise<T> {
    const text = await this.text()
    try {
      return JSON.parse(text) as T
    } catch (error) {
      throw new Error(`Unable to parse resource file ${JSON.stringify(this.name)} as JSON`, {
        cause: error,
      })
    }
  }

  async read<T>(reader: ResourceFileReader<T>): Promise<T> {
    return reader(this)
  }

  async stream(): Promise<ReadableStream<Uint8Array<ArrayBufferLike>>> {
    const response = await this.fetch()
    if (response.body === null) {
      throw new Error(`Resource file ${JSON.stringify(this.name)} has no response body`)
    }
    return response.body
  }

  async dsv(options: ResourceFileDsvArrayOptions): Promise<ResourceFileDsvArrayResult>
  async dsv(options?: ResourceFileDsvObjectOptions): Promise<ResourceFileDsvObjectResult>
  async dsv(options: ResourceFileDsvOptions): Promise<ResourceFileDsvResult>
  async dsv(options: ResourceFileDsvOptions = {}): Promise<ResourceFileDsvResult> {
    return this.readDsv(options)
  }

  async csv(
    options: Omit<ResourceFileDsvArrayOptions, 'delimiter'>,
  ): Promise<ResourceFileDsvArrayResult>
  async csv(
    options?: Omit<ResourceFileDsvObjectOptions, 'delimiter'>,
  ): Promise<ResourceFileDsvObjectResult>
  async csv(options: Omit<ResourceFileDsvOptions, 'delimiter'>): Promise<ResourceFileDsvResult>
  async csv(
    options: Omit<ResourceFileDsvOptions, 'delimiter'> = {},
  ): Promise<ResourceFileDsvResult> {
    return this.readDsv({ ...options, delimiter: ',' })
  }

  async tsv(
    options: Omit<ResourceFileDsvArrayOptions, 'delimiter'>,
  ): Promise<ResourceFileDsvArrayResult>
  async tsv(
    options?: Omit<ResourceFileDsvObjectOptions, 'delimiter'>,
  ): Promise<ResourceFileDsvObjectResult>
  async tsv(options: Omit<ResourceFileDsvOptions, 'delimiter'>): Promise<ResourceFileDsvResult>
  async tsv(
    options: Omit<ResourceFileDsvOptions, 'delimiter'> = {},
  ): Promise<ResourceFileDsvResult> {
    return this.readDsv({ ...options, delimiter: '\t' })
  }

  async xml(mimeType: DOMParserSupportedType = 'application/xml'): Promise<Document> {
    if (globalThis.DOMParser === undefined) {
      throw new Error(
        `Unable to parse resource file ${JSON.stringify(this.name)} as ${mimeType}: DOMParser is unavailable in this environment`,
      )
    }

    const text = await this.text()
    try {
      const document = new DOMParser().parseFromString(text, mimeType)
      if (mimeType !== 'text/html' && document.querySelector('parsererror') !== null) {
        throw new Error(document.querySelector('parsererror')?.textContent ?? 'Malformed XML')
      }
      return document
    } catch (error) {
      throw new Error(`Unable to parse resource file ${JSON.stringify(this.name)} as ${mimeType}`, {
        cause: error,
      })
    }
  }

  async html(): Promise<Document> {
    return this.xml('text/html')
  }

  async image(properties: Partial<HTMLImageElement> = {}): Promise<HTMLImageElement> {
    if (globalThis.Image === undefined) {
      throw new Error(
        `Unable to load resource file ${JSON.stringify(this.name)} as an image: Image is unavailable in this environment`,
      )
    }

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      if (
        globalThis.document !== undefined &&
        globalThis.location !== undefined &&
        new URL(this.href, document.baseURI).origin !== location.origin
      ) {
        image.crossOrigin = 'anonymous'
      }

      // Cross-origin anonymity is a safe default, but an explicit caller policy must win.
      Object.assign(image, properties)
      image.onload = () => resolve(image)
      image.onerror = () => {
        reject(
          new Error(
            `Unable to load resource file ${JSON.stringify(this.name)} as an image from ${JSON.stringify(this.href)}`,
          ),
        )
      }
      image.src = this.href
    })
  }

  private async readDsv(options: ResourceFileDsvOptions): Promise<ResourceFileDsvResult> {
    const text = await this.text()
    try {
      return parseResourceFileDsv(text, options)
    } catch (error) {
      throw new Error(
        `Unable to parse resource file ${JSON.stringify(this.name)} as delimiter-separated values`,
        { cause: error },
      )
    }
  }

  private async fetch(): Promise<Response> {
    let response: Response
    try {
      response = await globalThis.fetch(this.href)
    } catch (error) {
      throw new Error(
        `Unable to load resource file ${JSON.stringify(this.name)} from ${JSON.stringify(this.href)}`,
        { cause: error },
      )
    }

    if (!response.ok) {
      const status = [response.status, response.statusText].filter(Boolean).join(' ')
      throw new Error(
        `Unable to load resource file ${JSON.stringify(this.name)} from ${JSON.stringify(this.href)}: ${status}`,
      )
    }
    return response
  }
}

function resolveHref(source: string | URL, base: string | URL | undefined): string {
  try {
    if (source instanceof URL) return source.href
    if (base !== undefined) return new URL(source, base).href

    // Vite root-relative asset URLs are browser fetch targets, not hierarchical URLs.
    if (source.startsWith('/')) return source
    const documentBase = globalThis.document?.baseURI
    if (documentBase !== undefined) return new URL(source, documentBase).href

    return new URL(source).href
  } catch (error) {
    throw new Error(`Invalid resource file URL ${JSON.stringify(`${source}`)}`, { cause: error })
  }
}

function inferName(href: string): string {
  const url = new URL(href, 'https://folio.invalid/')
  if (url.protocol === 'data:') return 'resource'
  const segment = url.pathname.split('/').filter(Boolean).at(-1)
  if (segment === undefined) return 'resource'

  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function requireText(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must be a non-empty string`)
}

function requireMetadataNumber(value: number | undefined, label: string): void {
  if (value === undefined) return
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number`)
  }
}
