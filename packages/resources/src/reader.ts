export type ResourceFileReaderSource = Readonly<{
  arrayBuffer(): Promise<ArrayBuffer>
  blob(): Promise<Blob>
  json<T = unknown>(): Promise<T>
  lastModified: number | undefined
  mimeType: string
  name: string
  read<T>(reader: ResourceFileReader<T>): Promise<T>
  size: number | undefined
  stream(): Promise<ReadableStream<Uint8Array<ArrayBufferLike>>>
  text(encoding?: string): Promise<string>
}>

export type ResourceFileReader<T> = (source: ResourceFileReaderSource) => Promise<T>
