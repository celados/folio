import { track } from 'ripple'

import type { NationSnapshot } from '../lib/world-development.ts'
import {
  formatCompact,
  layoutTreemap,
  REGION_COLORS,
} from '../lib/world-development.ts'

type RegionalTreemapProps = {
  data: readonly NationSnapshot[]
  onSelectCountry: (name: string) => void
  year: number
}

const WIDTH = 620
const HEIGHT = 340

export function RegionalTreemap(props: RegionalTreemapProps) @{
  const &{ data, onSelectCountry, year } = props
  let &[focusRegion] = track<string | null>(null)
  let &[hoveredName] = track<string | null>(null)
  let &[cells] = track(() => layoutTreemap(data, focusRegion, WIDTH, HEIGHT))
  let &[hoveredCell] = track(() => cells.find((cell) => cell.name === hoveredName))

  const activateCell = (name: string, region: string) => {
    if (focusRegion === null) {
      focusRegion = region
    } else {
      onSelectCountry(name)
    }
  }

  <section class="panel treemap-panel" aria-labelledby="treemap-title">
    <div class="panel-heading">
      <div>
        <p class="kicker">Zoomable treemap</p>
        <h2 id="treemap-title">Population hierarchy</h2>
      </div>
      @if (focusRegion !== null) {
        <button type="button" onClick={() => (focusRegion = null)}>← All regions</button>
      } @else {
        <span class="hint">Select a region to reveal its countries</span>
      }
    </div>

    <div class="treemap-frame">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Population hierarchy in ${year}`}>
        @for (let cell of cells) {
          <g
            class="cell"
            onClick={() => activateCell(cell.name, cell.region)}
            onMouseEnter={() => (hoveredName = cell.name)}
            onMouseLeave={() => (hoveredName = null)}
          >
            <rect
              x={cell.x0}
              y={cell.y0}
              width={Math.max(0, cell.x1 - cell.x0)}
              height={Math.max(0, cell.y1 - cell.y0)}
              fill={REGION_COLORS[cell.region as keyof typeof REGION_COLORS] ?? '#777'}
            />
            @if (cell.x1 - cell.x0 > 74 && cell.y1 - cell.y0 > 34) {
              <text x={cell.x0 + 10} y={cell.y0 + 18}>
                <tspan class="name">{cell.name}</tspan>
                <tspan class="value" x={cell.x0 + 10} dy="15">{formatCompact(cell.population)}</tspan>
              </text>
            }
          </g>
        }
      </svg>

      @if (hoveredCell !== undefined) {
        <div class="tooltip">
          <strong>{hoveredCell?.name ?? ''}</strong>
          <span>{formatCompact(hoveredCell?.population ?? 0)} people</span>
        </div>
      }
    </div>

    <style>
      .panel {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--surface);
        box-shadow: 0 22px 70px rgba(23, 34, 30, 0.06);
      }

      .treemap-panel {
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

      button {
        padding: 5px 0;
        color: var(--ink);
        border: 0;
        border-bottom: 1px solid currentColor;
        background: transparent;
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 700;
      }

      .hint {
        max-width: 150px;
        color: var(--muted);
        font-size: 10px;
        line-height: 1.45;
        text-align: right;
      }

      .treemap-frame {
        position: relative;
        margin-top: 12px;
      }

      svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .cell {
        cursor: pointer;
      }

      rect {
        stroke: var(--surface);
        stroke-width: 1;
        transition: x 220ms ease, y 220ms ease, width 220ms ease, height 220ms ease, opacity 140ms ease;
      }

      .cell:hover rect {
        opacity: 0.78;
      }

      text {
        fill: white;
        pointer-events: none;
      }

      .name {
        font-size: 11px;
        font-weight: 750;
      }

      .value {
        fill: rgba(255, 255, 255, 0.78);
        font-size: 9px;
      }

      .tooltip {
        position: absolute;
        right: 10px;
        bottom: 10px;
        display: flex;
        flex-direction: column;
        padding: 9px 11px;
        border-radius: 10px;
        background: rgba(20, 31, 27, 0.9);
        color: white;
        pointer-events: none;
      }

      .tooltip strong {
        font-size: 11px;
      }

      .tooltip span {
        color: rgba(255, 255, 255, 0.7);
        font-size: 9px;
      }
    </style>
  </section>
}
