import type { NationHistory, SeriesPoint } from '../resources/world-development.resource.ts'
import { hierarchy, treemap, treemapBinary } from 'd3'

export const FIRST_YEAR = 1800
export const LAST_YEAR = 2008

export const REGION_COLORS = {
  America: '#ff6b4a',
  'East Asia & Pacific': '#12a594',
  'Europe & Central Asia': '#6772e5',
  'Middle East & North Africa': '#d99a19',
  'South Asia': '#b15bc4',
  'Sub-Saharan Africa': '#6c8b3c',
} as const

export type Region = keyof typeof REGION_COLORS

export type NationSnapshot = {
  income: number
  lifeExpectancy: number
  name: string
  population: number
  region: string
}

export type Brush = {
  endX: number
  endY: number
  startX: number
  startY: number
}

export function assertWorldDevelopmentData(histories: readonly NationHistory[]): void {
  for (const nation of histories) {
    for (const [metric, series] of [
      ['income', nation.income],
      ['lifeExpectancy', nation.lifeExpectancy],
      ['population', nation.population],
    ] as const) {
      for (const point of series) {
        if (!point.every((value) => typeof value === 'number' && Number.isFinite(value))) {
          throw new TypeError(`${nation.name}.${metric} must contain finite numeric tuples`)
        }
      }
    }
  }
}

export type TreemapCell = {
  name: string
  population: number
  region: string
  x0: number
  x1: number
  y0: number
  y1: number
}

export function valueAt(series: readonly SeriesPoint[], year: number): number {
  if (series.length === 0) {
    return Number.NaN
  }

  let lower = 0
  let upper = series.length

  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2)
    if (series[middle]![0] < year) {
      lower = middle + 1
    } else {
      upper = middle
    }
  }

  const after = series[Math.min(lower, series.length - 1)]!
  const before = series[Math.max(0, lower - 1)]!

  if (after[0] === before[0]) {
    return after[1]
  }

  const progress = (year - before[0]) / (after[0] - before[0])
  return before[1] + (after[1] - before[1]) * progress
}

export function snapshotAt(histories: readonly NationHistory[], year: number): NationSnapshot[] {
  return histories.map((nation) => ({
    income: valueAt(nation.income, year),
    lifeExpectancy: valueAt(nation.lifeExpectancy, year),
    name: nation.name,
    population: valueAt(nation.population, year),
    region: nation.region,
  }))
}

export function filterSnapshots(
  snapshots: readonly NationSnapshot[],
  region: string,
  query: string,
): NationSnapshot[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return snapshots.filter(
    (nation) =>
      (region === 'All regions' || nation.region === region) &&
      (normalizedQuery === '' || nation.name.toLocaleLowerCase().includes(normalizedQuery)),
  )
}

export function summarize(snapshots: readonly NationSnapshot[]) {
  const populations = snapshots.map((nation) => nation.population)
  const totalPopulation = populations.reduce((sum, value) => sum + value, 0)

  if (snapshots.length === 0 || totalPopulation === 0) {
    return { income: 0, lifeExpectancy: 0, population: 0 }
  }

  return snapshots.reduce(
    (summary, nation) => {
      const weight = nation.population / totalPopulation
      summary.income += nation.income * weight
      summary.lifeExpectancy += nation.lifeExpectancy * weight
      return summary
    },
    { income: 0, lifeExpectancy: 0, population: totalPopulation },
  )
}

export function regionTotals(snapshots: readonly NationSnapshot[]) {
  const totals = new Map<string, number>()

  for (const nation of snapshots) {
    totals.set(nation.region, (totals.get(nation.region) ?? 0) + nation.population)
  }

  return Array.from(totals, ([name, population]) => ({ name, population })).sort(
    (left, right) => right.population - left.population,
  )
}

export function snapshotPosition(nation: NationSnapshot) {
  const minIncome = Math.log(200)
  const incomeRange = Math.log(100_000) - minIncome

  return {
    x: (Math.log(Math.max(200, nation.income)) - minIncome) / incomeRange,
    y: (86 - nation.lifeExpectancy) / (86 - 14),
  }
}

export function selectByBrush(
  snapshots: readonly NationSnapshot[],
  brush: Brush | null,
): NationSnapshot[] {
  if (brush === null) {
    return []
  }

  const left = Math.min(brush.startX, brush.endX)
  const right = Math.max(brush.startX, brush.endX)
  const top = Math.min(brush.startY, brush.endY)
  const bottom = Math.max(brush.startY, brush.endY)

  return snapshots.filter((nation) => {
    const position = snapshotPosition(nation)
    return position.x >= left && position.x <= right && position.y >= top && position.y <= bottom
  })
}

export function layoutTreemap(
  snapshots: readonly NationSnapshot[],
  focusRegion: string | null,
  width: number,
  height: number,
): TreemapCell[] {
  const children =
    focusRegion === null
      ? regionTotals(snapshots).map(({ name, population }) => ({
          name,
          population,
          region: name,
        }))
      : snapshots
          .filter((nation) => nation.region === focusRegion)
          .map(({ name, population, region }) => ({ name, population, region }))

  const root = hierarchy({ children, name: 'World', population: 0, region: 'World' })
    .sum((datum) => datum.population)
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))

  treemap<typeof root.data>()
    .tile(treemapBinary)
    .size([width, height])
    .paddingInner(3)
    .paddingOuter(0)(root)

  return root.leaves().map((node) => ({
    name: node.data.name,
    population: node.data.population,
    region: node.data.region,
    x0: node.x0,
    x1: node.x1,
    y0: node.y0,
    y1: node.y1,
  }))
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en', {
    currency: 'USD',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value)
}
