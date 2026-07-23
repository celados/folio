import { scaleLinear, scaleLog, scaleSqrt } from 'd3'
import { track } from 'ripple'

import type { Brush, NationSnapshot } from '../lib/world-development.ts'
import {
  formatCompact,
  formatCurrency,
  REGION_COLORS,
  snapshotPosition,
} from '../lib/world-development.ts'

type WealthHealthChartProps = {
  brush: Brush | null
  data: readonly NationSnapshot[]
  onBrushChange: (brush: Brush | null) => void
  onSelectCountry: (name: string) => void
  selectedCountry: string
  year: number
}

const WIDTH = 980
const HEIGHT = 520
const MARGIN = { bottom: 54, left: 64, right: 24, top: 24 }
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom
const INCOME_TICKS = [500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000]
const LIFE_TICKS = [20, 30, 40, 50, 60, 70, 80]

export function WealthHealthChart(props: WealthHealthChartProps) @{
  const &{ brush, data, onBrushChange, onSelectCountry, selectedCountry, year } = props
  let &[hoveredName] = track<string | null>(null)
  const x = scaleLog([200, 100_000], [MARGIN.left, WIDTH - MARGIN.right])
  const y = scaleLinear([14, 86], [HEIGHT - MARGIN.bottom, MARGIN.top])
  const radius = scaleSqrt([0, 1_400_000_000], [3, 40])
  let &[hoveredNation] = track(() => data.find((nation) => nation.name === hoveredName))

  const pointFromEvent = (event: PointerEvent) => {
    const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    }
  }

  const startBrush = (event: PointerEvent) => {
    const target = event.currentTarget as SVGRectElement
    target.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    onBrushChange({ endX: point.x, endY: point.y, startX: point.x, startY: point.y })
  }

  const moveBrush = (event: PointerEvent) => {
    if (brush === null || event.buttons === 0) return
    const point = pointFromEvent(event)
    onBrushChange({ ...brush, endX: point.x, endY: point.y })
  }

  const brushX = () =>
    MARGIN.left + Math.min(brush?.startX ?? 0, brush?.endX ?? 0) * PLOT_WIDTH
  const brushY = () => MARGIN.top + Math.min(brush?.startY ?? 0, brush?.endY ?? 0) * PLOT_HEIGHT
  const brushWidth = () => Math.abs((brush?.endX ?? 0) - (brush?.startX ?? 0)) * PLOT_WIDTH
  const brushHeight = () => Math.abs((brush?.endY ?? 0) - (brush?.startY ?? 0)) * PLOT_HEIGHT

  <section class="panel scatter-panel" aria-labelledby="wealth-health-title">
    <div class="panel-heading">
      <div>
        <p class="kicker">Animated scatterplot · brush selection</p>
        <h2 id="wealth-health-title">Wealth &amp; health in {String(year)}</h2>
      </div>
      <div class="brush-status">
        <span>Drag across the plot to compare a cohort</span>
        @if (brush !== null) {
          <button type="button" onClick={() => onBrushChange(null)}>Clear selection</button>
        }
      </div>
    </div>

    <div class="chart-frame">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Wealth and health of ${data.length} nations in ${year}`}>
        <g class="grid">
          @for (let tick of INCOME_TICKS) {
            <line x1={x(tick)} x2={x(tick)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} />
          }
          @for (let tick of LIFE_TICKS) {
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} />
          }
        </g>

        <g class="axes">
          @for (let tick of INCOME_TICKS) {
            <text x={x(tick)} y={HEIGHT - 22} text-anchor="middle">{formatCompact(tick)}</text>
          }
          @for (let tick of LIFE_TICKS) {
            <text x={MARGIN.left - 12} y={y(tick) + 4} text-anchor="end">{String(tick)}</text>
          }
          <text class="axis-label" x={WIDTH - MARGIN.right} y={HEIGHT - 3} text-anchor="end">Income per person →</text>
          <text class="axis-label" x={MARGIN.left} y={14}>↑ Life expectancy</text>
        </g>

        <rect
          class="brush-target"
          x={MARGIN.left}
          y={MARGIN.top}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          onPointerDown={startBrush}
          onPointerMove={moveBrush}
        />

        @if (brush !== null) {
          <rect
            class="brush-box"
            x={brushX()}
            y={brushY()}
            width={brushWidth()}
            height={brushHeight()}
          />
        }

        <g class="bubbles">
          @for (let nation of data.toSorted((left, right) => right.population - left.population)) {
            <circle
              class={nation.name === selectedCountry ? 'selected' : ''}
              cx={x(nation.income)}
              cy={y(nation.lifeExpectancy)}
              r={radius(nation.population)}
              fill={REGION_COLORS[nation.region as keyof typeof REGION_COLORS] ?? '#777'}
              opacity={
                brush === null || (() => {
                  const point = snapshotPosition(nation)
                  return point.x >= Math.min(brush.startX, brush.endX) &&
                    point.x <= Math.max(brush.startX, brush.endX) &&
                    point.y >= Math.min(brush.startY, brush.endY) &&
                    point.y <= Math.max(brush.startY, brush.endY)
                })()
                  ? 0.8
                  : 0.13
              }
              onClick={() => onSelectCountry(nation.name)}
              onMouseEnter={() => (hoveredName = nation.name)}
              onMouseLeave={() => (hoveredName = null)}
            >
              <title>{nation.name}</title>
            </circle>
          }
        </g>
      </svg>

      @if (hoveredNation !== undefined) {
        <aside class="chart-tooltip" aria-live="polite">
          <strong>{hoveredNation?.name ?? ''}</strong>
          <span>{hoveredNation?.region ?? ''}</span>
          <dl>
            <div><dt>Income</dt><dd>{formatCurrency(hoveredNation?.income ?? 0)}</dd></div>
            <div><dt>Life</dt><dd>{(hoveredNation?.lifeExpectancy ?? 0).toFixed(1)} years</dd></div>
            <div><dt>Population</dt><dd>{formatCompact(hoveredNation?.population ?? 0)}</dd></div>
          </dl>
        </aside>
      }
    </div>

    <div class="legend" aria-label="Regions">
      @for (let entry of Object.entries(REGION_COLORS)) {
        <span><i style={`--swatch:${entry[1]}`} />{entry[0]}</span>
      }
    </div>

    <style>
      .panel {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--surface);
        box-shadow: 0 22px 70px rgba(23, 34, 30, 0.06);
      }

      .scatter-panel {
        padding: clamp(18px, 3vw, 32px);
      }

      .panel-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 18px;
      }

      .kicker {
        margin: 0 0 6px;
        color: var(--accent);
        font-size: 11px;
        font-weight: 750;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h2 {
        margin: 0;
        font-family: var(--serif);
        font-size: clamp(24px, 4vw, 38px);
        font-weight: 500;
        letter-spacing: -0.035em;
      }

      .brush-status {
        display: flex;
        align-items: end;
        flex-direction: column;
        gap: 6px;
        color: var(--muted);
        font-size: 12px;
      }

      button {
        padding: 0;
        color: var(--ink);
        border: 0;
        border-bottom: 1px solid currentColor;
        background: transparent;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
      }

      .chart-frame {
        position: relative;
      }

      svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
      }

      .grid line {
        stroke: var(--line);
        stroke-width: 1;
      }

      .axes text {
        fill: var(--muted);
        font-size: 11px;
      }

      .axes .axis-label {
        fill: var(--ink);
        font-size: 12px;
        font-weight: 650;
      }

      .brush-target {
        fill: transparent;
        cursor: crosshair;
      }

      .brush-box {
        fill: rgba(19, 165, 148, 0.12);
        stroke: var(--teal);
        stroke-dasharray: 5 4;
        pointer-events: none;
      }

      circle {
        stroke: var(--surface);
        stroke-width: 1;
        cursor: pointer;
        transition: cx 160ms linear, cy 160ms linear, r 160ms linear, opacity 160ms ease;
      }

      circle:hover,
      circle.selected {
        opacity: 1;
        stroke: var(--ink);
        stroke-width: 2.5;
      }

      .chart-tooltip {
        position: absolute;
        top: 20px;
        right: 18px;
        width: min(210px, 48%);
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: rgba(255, 255, 252, 0.94);
        box-shadow: 0 16px 40px rgba(23, 34, 30, 0.12);
        backdrop-filter: blur(8px);
        pointer-events: none;
      }

      .chart-tooltip strong,
      .chart-tooltip span {
        display: block;
      }

      .chart-tooltip span,
      dt {
        color: var(--muted);
        font-size: 10px;
      }

      dl {
        display: grid;
        gap: 6px;
        margin: 12px 0 0;
      }

      dl div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      dd {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        margin-top: 10px;
        color: var(--muted);
        font-size: 10px;
      }

      .legend span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .legend i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--swatch);
      }

      @media (max-width: 720px) {
        .panel-heading {
          align-items: start;
          flex-direction: column;
        }

        .brush-status {
          align-items: start;
        }
      }
    </style>
  </section>
}
