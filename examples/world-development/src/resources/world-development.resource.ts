import { defineSqlResource } from '@celados/folio-resources'

export type SeriesPoint = readonly [year: number, value: number]

export type NationHistory = {
  income: readonly SeriesPoint[]
  lifeExpectancy: readonly SeriesPoint[]
  name: string
  population: readonly SeriesPoint[]
  region: string
}

// The original attachment is retained as build input so provenance and cache invalidation
// remain properties of the generated Resource rather than browser fetch behavior.
export const worldDevelopment = defineSqlResource<NationHistory>({
  adapter: 'duckdb',
  inputs: { nations: './world-development/nations.json' },
  query: `
    select
      name,
      region,
      income,
      list_transform(
        population,
        point -> [cast(point[1] as double), cast(point[2] as double)]
      ) as population,
      "lifeExpectancy" as "lifeExpectancy"
    from nations
    order by name
  `,
})
