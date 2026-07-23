import { bindValue, effect, track } from 'ripple'
import { DataTable, DownloadButton, Inspector } from '@celados/folio-ui'
import type { DataTableColumn } from '@celados/folio-ui'

import { CountryHistoryChart } from './country-history-chart.tsrx'
import { RegionalTreemap } from './regional-treemap.tsrx'
import { WealthHealthChart } from './wealth-health-chart.tsrx'
import {
  assertWorldDevelopmentData,
  filterSnapshots,
  FIRST_YEAR,
  formatCompact,
  formatCurrency,
  LAST_YEAR,
  REGION_COLORS,
  selectByBrush,
  snapshotAt,
  summarize,
  type NationSnapshot,
} from '../lib/world-development.ts'
import { worldDevelopment } from '../resources/world-development.resource.ts'

export type WorldDevelopmentReportProps = {
  subtitle: string
  title: string
}

const ALL_REGIONS = 'All regions'
const TABLE_COLUMNS: readonly DataTableColumn<NationSnapshot>[] = [
  { label: 'Country', value: (nation) => nation.name },
  { label: 'Region', value: (nation) => nation.region },
  { align: 'right', label: 'Income', value: (nation) => formatCurrency(nation.income) },
  {
    align: 'right',
    label: 'Life expectancy',
    value: (nation) => `${nation.lifeExpectancy.toFixed(1)} years`,
  },
  { align: 'right', label: 'Population', value: (nation) => formatCompact(nation.population) },
]

export function WorldDevelopmentReport(props: WorldDevelopmentReportProps) @{
  let &[year] = track(LAST_YEAR)
  let &[playing] = track(false)
  let &[region] = track(ALL_REGIONS)
  let &[query] = track('')
  let &[selectedCountry] = track('China')
  let &[brush] = track<import('../lib/world-development.ts').Brush | null>(null)
  const histories = worldDevelopment.data
  assertWorldDevelopmentData(histories)
  let &[snapshot] = track(() => snapshotAt(histories, year))
  let &[visible] = track(() => filterSnapshots(snapshot, region, query))
  let &[selection] = track(() => selectByBrush(visible, brush))
  let &[summary] = track(() => summarize(visible))
  let &[selectedHistory] = track(
    () => histories.find((nation) => nation.name === selectedCountry) ?? histories[0]!,
  )
  let &[tableRows] = track(() =>
    (selection.length > 0 ? selection : visible)
      .toSorted((left, right) => right.population - left.population)
      .slice(0, 10),
  )

  effect(() => {
    if (!playing) return

    const timer = window.setInterval(() => {
      if (year >= LAST_YEAR) {
        year = FIRST_YEAR
      } else {
        year += 1
      }
    }, 120)

    return () => window.clearInterval(timer)
  })

  const setYear = (nextYear: number) => {
    year = Math.max(FIRST_YEAR, Math.min(LAST_YEAR, nextYear))
  }

  const selectCountry = (name: string) => {
    selectedCountry = name
  }

  const serializeSnapshot = () => {
    const columns = ['country', 'region', 'income', 'life_expectancy', 'population']
    const rows = visible.map((nation) =>
      [nation.name, nation.region, nation.income, nation.lifeExpectancy, nation.population]
        .map((value) => JSON.stringify(value))
        .join(','),
    )
    return [columns.join(','), ...rows].join('\n')
  }

  <article class="report">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Folio · official notebook migration</p>
        <h1>{props.title}</h1>
        <p class="subtitle">{props.subtitle}</p>
      </div>
      <div class="year-display" aria-live="polite">
        <span>Report year</span>
        <strong>{String(year)}</strong>
      </div>
    </header>

    <section class="timeline" aria-label="Timeline controls">
      <button class="play-button" type="button" onClick={() => (playing = !playing)}>
        <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
        {playing ? 'Pause' : 'Play 209 years'}
      </button>
      <input
        aria-label="Report year"
        type="range"
        min={FIRST_YEAR}
        max={LAST_YEAR}
        step="1"
        ref={bindValue(() => String(year), (value) => setYear(Number(value)))}
      />
      <span>{String(FIRST_YEAR)}</span>
      <span>{String(LAST_YEAR)}</span>
    </section>

    <section class="filters" aria-label="Data filters">
      <label>
        <span>Region</span>
        <select ref={bindValue(() => region, (value) => {
          region = value
          brush = null
        })}>
          <option value={ALL_REGIONS}>{ALL_REGIONS}</option>
          @for (let regionName of Object.keys(REGION_COLORS)) {
            <option value={regionName}>{regionName}</option>
          }
        </select>
      </label>
      <label class="search-field">
        <span>Find a country</span>
        <input
          type="search"
          placeholder="Try Japan, Brazil, Kenya…"
          ref={bindValue(() => query, (value) => {
            query = value
            brush = null
          })}
        />
      </label>
      <DownloadButton
        content={serializeSnapshot}
        filename={() => `world-development-${year}.csv`}
        label="Export visible CSV"
        mediaType="text/csv"
      />
    </section>

    <section class="summary" aria-label="Year summary">
      <article>
        <span>Visible population</span>
        <strong>{formatCompact(summary.population)}</strong>
        <small>{visible.length} countries</small>
      </article>
      <article>
        <span>Weighted life expectancy</span>
        <strong>{summary.lifeExpectancy.toFixed(1)}</strong>
        <small>years</small>
      </article>
      <article>
        <span>Weighted income</span>
        <strong>{formatCurrency(summary.income)}</strong>
        <small>per person</small>
      </article>
      <article>
        <span>Brush cohort</span>
        <strong>{String(selection.length)}</strong>
        <small>{selection.length === 0 ? 'drag on chart' : 'selected countries'}</small>
      </article>
    </section>

    <WealthHealthChart
      data={visible}
      year={year}
      brush={brush}
      selectedCountry={selectedCountry}
      onBrushChange={(nextBrush) => (brush = nextBrush)}
      onSelectCountry={selectCountry}
    />

    <section class="detail-grid">
      <RegionalTreemap data={snapshot} year={year} onSelectCountry={selectCountry} />
      <CountryHistoryChart history={selectedHistory} year={year} onYearChange={setYear} />
    </section>

    <section class="table-panel" aria-labelledby="table-title">
      <div class="table-heading">
        <div>
          <p class="eyebrow">Linked data view</p>
          <h2 id="table-title">{selection.length > 0 ? 'Brushed cohort' : 'Largest visible countries'}</h2>
        </div>
        <span>{tableRows.length} of {selection.length > 0 ? selection.length : visible.length} rows</span>
      </div>
      <DataTable
        caption="World development rows"
        columns={TABLE_COLUMNS}
        rows={tableRows}
        rowKey={(nation) => nation.name}
        isSelected={(nation) => nation.name === selectedCountry}
        onSelect={(nation) => selectCountry(nation.name)}
      />
    </section>

    <section class="resource-inspectors" aria-label="Resource diagnostics">
      <Inspector label="Resource schema" value={worldDevelopment.schema} />
      <Inspector label="Resource provenance" value={worldDevelopment.provenance} />
    </section>

    <footer>
      <div>
        <strong>One named TSRX component, ordinary ESM.</strong>
        <span>Data is compiled by DuckDB into a typed Folio Resource; no Observable runtime or iframe ships to the browser.</span>
      </div>
      <nav aria-label="Source notebooks">
        <a href="https://observablehq.com/@mbostock/the-wealth-health-of-nations" target="_blank" rel="noreferrer">Wealth &amp; Health</a>
        <a href="https://observablehq.com/@d3/brushable-scatterplot" target="_blank" rel="noreferrer">Brushable Scatterplot</a>
        <a href="https://observablehq.com/@d3/zoomable-treemap" target="_blank" rel="noreferrer">Zoomable Treemap</a>
        <a href="https://observablehq.com/@d3/line-with-tooltip/2" target="_blank" rel="noreferrer">Line with Tooltip</a>
      </nav>
    </footer>

    <style>
      .report {
        --ink: #17221e;
        --muted: #66716c;
        --line: #dce3df;
        --accent: #f05a3a;
        --teal: #12a594;
        --paper: #f2f5f1;
        --surface: #fffffc;
        --folio-action: var(--teal);
        --folio-ink: var(--ink);
        --folio-line: var(--line);
        --folio-muted: var(--muted);
        --folio-selected: #f0f7f4;
        --folio-surface: var(--surface);
        --serif: Iowan Old Style, Baskerville, Georgia, serif;
        width: min(100%, 1180px);
        margin: 0 auto;
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: 32px;
        padding: clamp(24px, 6vw, 72px) 0 34px;
      }

      .eyebrow {
        margin: 0 0 10px;
        color: var(--accent);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.15em;
        text-transform: uppercase;
      }

      h1 {
        max-width: 900px;
        margin: 0;
        font-family: var(--serif);
        font-size: clamp(46px, 8vw, 94px);
        font-weight: 500;
        letter-spacing: -0.06em;
        line-height: 0.88;
      }

      .subtitle {
        max-width: 720px;
        margin: 22px 0 0;
        color: var(--muted);
        font-size: clamp(14px, 2vw, 18px);
        line-height: 1.6;
      }

      .year-display {
        display: flex;
        align-items: end;
        flex-direction: column;
      }

      .year-display span {
        color: var(--muted);
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .year-display strong {
        font-family: var(--serif);
        font-size: clamp(54px, 8vw, 96px);
        font-weight: 500;
        letter-spacing: -0.07em;
        line-height: 0.9;
      }

      .timeline {
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        align-items: center;
        gap: 14px;
        padding: 15px 18px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--surface);
      }

      .play-button {
        border: 0;
        border-radius: 999px;
        background: var(--ink);
        color: white;
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 750;
      }

      .play-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 13px;
      }

      .timeline > span {
        color: var(--muted);
        font-size: 10px;
      }

      input[type='range'] {
        width: 100%;
        accent-color: var(--accent);
      }

      .filters {
        display: grid;
        grid-template-columns: minmax(170px, 0.7fr) minmax(230px, 1.3fr) auto;
        gap: 12px;
        margin: 16px 0;
      }

      label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 14px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
      }

      label span {
        color: var(--muted);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      select,
      input[type='search'] {
        width: 100%;
        padding: 0;
        color: var(--ink);
        border: 0;
        outline: 0;
        background: transparent;
        font: inherit;
        font-size: 12px;
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin: 16px 0;
      }

      .summary article {
        display: flex;
        min-height: 126px;
        flex-direction: column;
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--surface);
      }

      .summary span,
      .summary small {
        color: var(--muted);
        font-size: 10px;
      }

      .summary strong {
        margin: auto 0 1px;
        font-family: var(--serif);
        font-size: clamp(27px, 4vw, 38px);
        font-weight: 500;
        letter-spacing: -0.04em;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin: 16px 0;
      }

      .table-panel {
        overflow: hidden;
        margin-top: 16px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--surface);
        box-shadow: 0 22px 70px rgba(23, 34, 30, 0.06);
      }

      .table-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        padding: 24px;
        border-bottom: 1px solid var(--line);
      }

      .table-heading h2 {
        margin: 0;
        font-family: var(--serif);
        font-size: 28px;
        font-weight: 500;
        letter-spacing: -0.035em;
      }

      .table-heading > span {
        color: var(--muted);
        font-size: 10px;
      }

      .resource-inspectors {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 16px;
      }

      footer {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 30px;
        padding: 32px 4px 10px;
        color: var(--muted);
        font-size: 10px;
        line-height: 1.55;
      }

      footer strong,
      footer span {
        display: block;
      }

      footer strong {
        color: var(--ink);
      }

      footer nav {
        display: flex;
        flex-wrap: wrap;
        justify-content: end;
        gap: 8px 14px;
      }

      footer a {
        color: var(--ink);
        text-decoration-color: var(--line);
        text-underline-offset: 3px;
      }

      @media (max-width: 820px) {
        .hero {
          grid-template-columns: 1fr;
        }

        .year-display {
          align-items: start;
        }

        .filters,
        .summary,
        .detail-grid {
          grid-template-columns: 1fr 1fr;
        }

        footer {
          grid-template-columns: 1fr;
        }

        footer nav {
          justify-content: start;
        }
      }

      @media (max-width: 560px) {
        .timeline {
          grid-template-columns: 1fr auto auto;
        }

        .timeline input {
          grid-column: 1 / -1;
          grid-row: 2;
        }

        .filters,
        .summary,
        .detail-grid,
        .resource-inspectors {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </article>
}
