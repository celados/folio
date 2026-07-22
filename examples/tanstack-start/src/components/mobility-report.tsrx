import { track } from 'ripple'

export type MobilityDatum = {
  change: number
  city: string
  trips: number
}

export type MobilityReportProps = {
  data: MobilityDatum[]
  period: string
  title: string
}

export function MobilityReport(props: MobilityReportProps) @{
  let &[metric] = track<'trips' | 'change'>('trips')
  const maxTrips = Math.max(...props.data.map((datum) => datum.trips))
  const maxChange = Math.max(...props.data.map((datum) => datum.change))
  const totalTrips = props.data.reduce((total, datum) => total + datum.trips, 0)
  const averageChange =
    props.data.reduce((total, datum) => total + datum.change, 0) / props.data.length

  <section class="report">
    <header class="report-header">
      <div>
        <p class="eyebrow">{'Folio · Ripple component'}</p>
        <h1>{props.title}</h1>
        <p class="period">{props.period}</p>
      </div>
      <div class="metric-switch" aria-label="Chart metric">
        <button
          class={metric === 'trips' ? 'active' : ''}
          onClick={() => (metric = 'trips')}
        >{'Trips'}</button>
        <button
          class={metric === 'change' ? 'active' : ''}
          onClick={() => (metric = 'change')}
        >{'Growth'}</button>
      </div>
    </header>

    <div class="summary">
      <article>
        <span>{'Recorded trips'}</span>
        <strong>{totalTrips.toLocaleString()}</strong>
      </article>
      <article>
        <span>{'Average growth'}</span>
        <strong>{'+' + averageChange.toFixed(1) + '%'}</strong>
      </article>
      <article>
        <span>{'Active regions'}</span>
        <strong>{String(props.data.length)}</strong>
      </article>
    </div>

    <div class="chart" aria-label="Mobility by city">
      @for (let datum of props.data) {
        <div class="chart-row">
          <span class="city">{datum.city}</span>
          <div class="track">
            <div
              class="bar"
              style={
                '--bar-width:' +
                String(
                  metric === 'trips'
                    ? (datum.trips / maxTrips) * 100
                    : (datum.change / maxChange) * 100,
                ) +
                '%'
              }
            />
          </div>
          <strong class="value">
            {metric === 'trips' ? datum.trips.toLocaleString() : '+' + datum.change + '%'}
          </strong>
        </div>
      }
    </div>

    <footer>
      <span>{'Source: static workspace data'}</span>
      <span>{'Rendered through @folio/react'}</span>
    </footer>

    <style>
      .report {
        --ink: #15241d;
        --muted: #65716b;
        --line: #dfe5e1;
        --accent: #ff5c35;
        --accent-soft: #fff0eb;
        width: min(100%, 980px);
        margin: 0 auto;
        padding: clamp(24px, 5vw, 56px);
        color: var(--ink);
        border: 1px solid var(--line);
        border-radius: 28px;
        background: #fbfcfa;
        box-shadow: 0 24px 80px rgba(21, 36, 29, 0.09);
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }

      .report-header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 24px;
      }

      .eyebrow {
        margin: 0 0 10px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-family: Georgia, serif;
        font-size: clamp(32px, 6vw, 64px);
        font-weight: 500;
        letter-spacing: -0.045em;
        line-height: 0.95;
      }

      .period {
        margin: 14px 0 0;
        color: var(--muted);
      }

      .metric-switch {
        display: flex;
        gap: 4px;
        padding: 4px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: white;
      }

      button {
        padding: 8px 14px;
        color: var(--muted);
        border: 0;
        border-radius: 999px;
        background: transparent;
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        font-weight: 650;
      }

      button.active {
        color: white;
        background: var(--ink);
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin: 42px 0;
      }

      article {
        display: flex;
        min-height: 116px;
        flex-direction: column;
        justify-content: space-between;
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: white;
      }

      article span {
        color: var(--muted);
        font-size: 13px;
      }

      article strong {
        font-family: Georgia, serif;
        font-size: 30px;
        font-weight: 500;
      }

      .chart {
        display: grid;
        gap: 18px;
      }

      .chart-row {
        display: grid;
        grid-template-columns: 92px 1fr 72px;
        align-items: center;
        gap: 16px;
      }

      .city,
      .value {
        font-size: 13px;
      }

      .value {
        text-align: right;
      }

      .track {
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: var(--accent-soft);
      }

      .bar {
        width: var(--bar-width);
        height: 100%;
        border-radius: inherit;
        background: var(--accent);
        transition: width 280ms ease;
      }

      footer {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-top: 42px;
        padding-top: 18px;
        color: var(--muted);
        border-top: 1px solid var(--line);
        font-size: 11px;
      }

      @media (max-width: 680px) {
        .report-header,
        footer {
          align-items: start;
          flex-direction: column;
        }

        .summary {
          grid-template-columns: 1fr;
        }

        .chart-row {
          grid-template-columns: 72px 1fr 62px;
          gap: 10px;
        }
      }
    </style>
  </section>
}
