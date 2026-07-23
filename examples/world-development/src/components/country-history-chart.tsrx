import { line, scaleLinear, scaleLog } from 'd3'
import { track } from 'ripple'

import type { NationHistory } from '../resources/world-development.resource.ts'
import { FIRST_YEAR, formatCurrency, LAST_YEAR, valueAt } from '../lib/world-development.ts'

type CountryHistoryChartProps = {
  history: NationHistory
  onYearChange: (year: number) => void
  year: number
}

type Metric = 'income' | 'lifeExpectancy'

const WIDTH = 620
const HEIGHT = 340
const MARGIN = { bottom: 42, left: 54, right: 22, top: 20 }

export function CountryHistoryChart(props: CountryHistoryChartProps) @{
  const &{ history, onYearChange, year } = props
  let &[metric] = track<Metric>('lifeExpectancy')
  let &[hoverYear] = track<number | null>(null)
  const x = scaleLinear([FIRST_YEAR, LAST_YEAR], [MARGIN.left, WIDTH - MARGIN.right])
  let &[series] = track(() => {
    const source = metric === 'income' ? history.income : history.lifeExpectancy
    return Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, index) => {
      const pointYear = FIRST_YEAR + index
      return { value: valueAt(source, pointYear), year: pointYear }
    })
  })
  let &[y] = track(() =>
    metric === 'income'
      ? scaleLog([200, 100_000], [HEIGHT - MARGIN.bottom, MARGIN.top])
      : scaleLinear([14, 86], [HEIGHT - MARGIN.bottom, MARGIN.top]),
  )
  let &[path] = track(() =>
    line<{ value: number; year: number }>()
      .x((point) => x(point.year))
      .y((point) => y(point.value))(series),
  )
  let &[activeYear] = track(() => hoverYear ?? year)
  let &[activeValue] = track(() => {
    const source = metric === 'income' ? history.income : history.lifeExpectancy
    return valueAt(source, activeYear)
  })

  const yearFromEvent = (event: PointerEvent) => {
    const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    return Math.round(FIRST_YEAR + ratio * (LAST_YEAR - FIRST_YEAR))
  }

  <section class="panel history-panel" aria-labelledby="history-title">
    <div class="panel-heading">
      <div>
        <p class="kicker">Line chart · pointer tooltip</p>
        <h2 id="history-title">{history.name} over time</h2>
      </div>
      <div class="metric-switch" aria-label="History metric">
        <button class={metric === 'lifeExpectancy' ? 'active' : ''} onClick={() => (metric = 'lifeExpectancy')}>Life</button>
        <button class={metric === 'income' ? 'active' : ''} onClick={() => (metric = 'income')}>Income</button>
      </div>
    </div>

    <div class="history-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${history.name} ${metric} history`}>
        <g class="grid">
          @for (let tick of [1800, 1850, 1900, 1950, 2000]) {
            <>
              <line x1={x(tick)} x2={x(tick)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} />
              <text x={x(tick)} y={HEIGHT - 18} text-anchor="middle">{String(tick)}</text>
            </>
          }
        </g>
        <path class="series" d={path ?? ''} />
        <line class="marker" x1={x(activeYear)} x2={x(activeYear)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} />
        <circle class="marker-dot" cx={x(activeYear)} cy={y(activeValue)} r="5" />
        <rect
          class="pointer-target"
          x={MARGIN.left}
          y={MARGIN.top}
          width={WIDTH - MARGIN.left - MARGIN.right}
          height={HEIGHT - MARGIN.top - MARGIN.bottom}
          onPointerMove={(event: PointerEvent) => (hoverYear = yearFromEvent(event))}
          onPointerLeave={() => (hoverYear = null)}
          onClick={() => onYearChange(activeYear)}
        />
      </svg>

      <div class="value-tooltip">
        <strong>{String(activeYear)}</strong>
        <span>{metric === 'income' ? formatCurrency(activeValue) : activeValue.toFixed(1) + ' years'}</span>
      </div>
    </div>

    <p class="instruction">Move across the chart for exact values. Click to set the report year.</p>

    <style>
      .panel {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--surface);
        box-shadow: 0 22px 70px rgba(23, 34, 30, 0.06);
      }

      .history-panel {
        min-width: 0;
        padding: 24px;
      }

      .panel-heading {
        display: flex;
        min-height: 62px;
        align-items: start;
        justify-content: space-between;
        gap: 16px;
      }

      .kicker {
        margin: 0 0 6px;
        color: var(--accent);
        font-size: 10px;
        font-weight: 750;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h2 {
        margin: 0;
        font-family: var(--serif);
        font-size: clamp(22px, 3vw, 30px);
        font-weight: 500;
        letter-spacing: -0.03em;
      }

      .metric-switch {
        display: flex;
        padding: 3px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--paper);
      }

      button {
        padding: 6px 10px;
        color: var(--muted);
        border: 0;
        border-radius: 999px;
        background: transparent;
        cursor: pointer;
        font: inherit;
        font-size: 10px;
        font-weight: 700;
      }

      button.active {
        color: white;
        background: var(--ink);
      }

      .history-chart {
        position: relative;
        margin-top: 12px;
      }

      svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .grid line {
        stroke: var(--line);
      }

      .grid text {
        fill: var(--muted);
        font-size: 9px;
      }

      .series {
        fill: none;
        stroke: var(--teal);
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 3;
      }

      .marker {
        stroke: var(--ink);
        stroke-dasharray: 4 4;
        opacity: 0.4;
      }

      .marker-dot {
        fill: var(--surface);
        stroke: var(--ink);
        stroke-width: 2;
      }

      .pointer-target {
        fill: transparent;
        cursor: crosshair;
      }

      .value-tooltip {
        position: absolute;
        top: 18px;
        right: 14px;
        display: flex;
        flex-direction: column;
        padding: 8px 10px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: rgba(255, 255, 252, 0.94);
        pointer-events: none;
      }

      .value-tooltip strong {
        font-size: 10px;
      }

      .value-tooltip span {
        color: var(--muted);
        font-size: 10px;
      }

      .instruction {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 9px;
      }
    </style>
  </section>
}
