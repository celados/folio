import { describe, expect, it } from 'vitest'

import {
  assertWorldDevelopmentData,
  filterSnapshots,
  layoutTreemap,
  selectByBrush,
  snapshotAt,
  summarize,
  valueAt,
} from './world-development'
import type { NationHistory } from '../resources/world-development.resource'

const history: NationHistory = {
  income: [
    [2000, 1_000],
    [2010, 2_000],
  ],
  lifeExpectancy: [
    [2000, 60],
    [2010, 70],
  ],
  name: 'Example',
  population: [
    [2000, 1_000_000],
    [2010, 2_000_000],
  ],
  region: 'America',
}

describe('world development model', () => {
  it('rejects Resource rows that drift from numeric tuple declarations', () => {
    const invalid = {
      ...history,
      population: [['2000', '1000000']],
    } as unknown as NationHistory

    expect(() => assertWorldDevelopmentData([invalid])).toThrow(
      'Example.population must contain finite numeric tuples',
    )
  })

  it('interpolates sparse official series and clamps outside their range', () => {
    expect(valueAt(history.income, 2005)).toBe(1_500)
    expect(valueAt(history.income, 1990)).toBe(1_000)
    expect(valueAt(history.income, 2020)).toBe(2_000)
  })

  it('creates a complete snapshot for a selected year', () => {
    expect(snapshotAt([history], 2005)).toEqual([
      {
        income: 1_500,
        lifeExpectancy: 65,
        name: 'Example',
        population: 1_500_000,
        region: 'America',
      },
    ])
  })

  it('filters by region and country name without changing source data', () => {
    const snapshot = snapshotAt([history], 2005)

    expect(filterSnapshots(snapshot, 'America', 'amp')).toHaveLength(1)
    expect(filterSnapshots(snapshot, 'Europe & Central Asia', '')).toHaveLength(0)
    expect(snapshot).toHaveLength(1)
  })

  it('uses population weighting for aggregate metrics', () => {
    const summary = summarize([
      { ...snapshotAt([history], 2000)[0]!, population: 1 },
      { ...snapshotAt([history], 2010)[0]!, population: 3 },
    ])

    expect(summary.population).toBe(4)
    expect(summary.income).toBe(1_750)
    expect(summary.lifeExpectancy).toBe(67.5)
  })

  it('selects rendered points from a normalized brush rectangle', () => {
    const snapshot = snapshotAt([history], 2005)

    expect(selectByBrush(snapshot, { endX: 1, endY: 1, startX: 0, startY: 0 })).toHaveLength(1)
    expect(selectByBrush(snapshot, { endX: 0.1, endY: 0.1, startX: 0, startY: 0 })).toHaveLength(0)
  })

  it('lays out both region and country hierarchy levels', () => {
    const snapshot = snapshotAt([history], 2005)

    expect(layoutTreemap(snapshot, null, 600, 320).map((cell) => cell.name)).toEqual(['America'])
    expect(layoutTreemap(snapshot, 'America', 600, 320).map((cell) => cell.name)).toEqual([
      'Example',
    ])
  })
})
