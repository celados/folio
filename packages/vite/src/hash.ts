import { createHash } from 'node:crypto'

export function hash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value))
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value !== 'object' || value === null) return value

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalize(child)]),
  )
}
