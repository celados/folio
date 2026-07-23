export type InspectorChild = Readonly<{
  key: string
  pathPart: string
  value: unknown
}>

export type InspectorValue = Readonly<{
  children: readonly InspectorChild[]
  kind: string
  summary: string
}>

export function describeInspectorValue(
  value: unknown,
  ancestors: readonly object[],
): InspectorValue {
  if (isObject(value) && ancestors.includes(value)) {
    return { children: [], kind: 'circular', summary: '[Circular]' }
  }
  if (value === null) return leaf('null', 'null')
  if (value === undefined) return leaf('undefined', 'undefined')
  if (typeof value === 'string') return leaf('string', JSON.stringify(value))
  if (typeof value === 'number') return leaf('number', formatNumber(value))
  if (typeof value === 'boolean') return leaf('boolean', String(value))
  if (typeof value === 'bigint') return leaf('bigint', `${value}n`)
  if (typeof value === 'symbol') return leaf('symbol', String(value))
  if (typeof value === 'function') {
    return leaf('function', `[Function${value.name ? ` ${value.name}` : ''}]`)
  }
  if (value instanceof Date) {
    return leaf('date', Number.isNaN(value.valueOf()) ? 'Invalid Date' : value.toISOString())
  }
  if (value instanceof Error) {
    return {
      children: errorChildren(value),
      kind: 'error',
      summary: `${value.name}: ${value.message}`,
    }
  }
  if (value instanceof Map) {
    return {
      children: Array.from(value, (entry, index) => ({
        key: `${formatCompact(entry[0])} →`,
        pathPart: String(index),
        value: entry[1],
      })),
      kind: 'map',
      summary: `Map(${value.size})`,
    }
  }
  if (value instanceof Set) {
    return {
      children: Array.from(value, (entry, index) => ({
        key: String(index),
        pathPart: String(index),
        value: entry,
      })),
      kind: 'set',
      summary: `Set(${value.size})`,
    }
  }
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const values = Array.from(value as unknown as ArrayLike<number | bigint>)
    return {
      children: values.map((entry, index) => ({
        key: String(index),
        pathPart: String(index),
        value: entry,
      })),
      kind: 'typed-array',
      summary: `${value.constructor.name}(${values.length})`,
    }
  }
  if (Array.isArray(value)) {
    return {
      children: value.map((entry, index) => ({
        key: String(index),
        pathPart: String(index),
        value: entry,
      })),
      kind: 'array',
      summary: `Array(${value.length})`,
    }
  }

  const prototype = Object.getPrototypeOf(value) as { constructor?: { name?: string } } | null
  const name = prototype?.constructor?.name
  return {
    children: objectChildren(value),
    kind: 'object',
    summary: name && name !== 'Object' ? name : '{…}',
  }
}

function errorChildren(value: Error) {
  const children: InspectorChild[] = []
  if (value.cause !== undefined) {
    children.push({ key: 'cause', pathPart: 'cause', value: value.cause })
  }
  if (value.stack) {
    children.push({ key: 'stack', pathPart: 'stack', value: value.stack })
  }
  const known = new Set(['name', 'message', 'cause', 'stack'])
  for (const key of Object.keys(value)) {
    if (!known.has(key)) children.push({ key, pathPart: key, value: value[key as keyof Error] })
  }
  return children
}

function objectChildren(value: object) {
  const children: InspectorChild[] = []
  for (const key of Reflect.ownKeys(value)) {
    const pathPart = typeof key === 'symbol' ? String(key) : key
    let childValue: unknown
    try {
      childValue = Reflect.get(value, key)
    } catch (error) {
      childValue = error
    }
    children.push({ key: pathPart, pathPart, value: childValue })
  }
  return children
}

function formatCompact(value: unknown) {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'object' && value !== null) return value.constructor?.name ?? 'Object'
  return String(value)
}

function formatNumber(value: number) {
  if (Number.isNaN(value)) return 'NaN'
  if (value === Number.POSITIVE_INFINITY) return 'Infinity'
  if (value === Number.NEGATIVE_INFINITY) return '-Infinity'
  if (Object.is(value, -0)) return '-0'
  return String(value)
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function'
}

function leaf(kind: string, summary: string): InspectorValue {
  return { children: [], kind, summary }
}
