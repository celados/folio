export function inferResourceFileMimeType(name: string, href?: string): string {
  const dataMimeType = href === undefined ? undefined : /^data:([^;,]+)/i.exec(href)?.[1]
  if (dataMimeType !== undefined) return dataMimeType

  const extension = /\.[^.]+$/.exec(name.toLowerCase())?.[0]
  switch (extension) {
    case '.arrow':
      return 'application/vnd.apache.arrow.file'
    case '.csv':
      return 'text/csv'
    case '.html':
    case '.htm':
      return 'text/html'
    case '.json':
      return 'application/json'
    case '.parquet':
      return 'application/vnd.apache.parquet'
    case '.svg':
      return 'image/svg+xml'
    case '.tsv':
      return 'text/tab-separated-values'
    case '.txt':
      return 'text/plain'
    case '.xml':
      return 'application/xml'
    case '.zip':
      return 'application/zip'
    case '.gif':
      return 'image/gif'
    case '.jpeg':
    case '.jpg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    default:
      return 'application/octet-stream'
  }
}
