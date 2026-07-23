import { track } from 'ripple'
import type { InspectorProps } from './types.ts'

export function Inspector(props: InspectorProps) @{
  let &[expanded] = track(false)
  const serialized = JSON.stringify(props.value, null, 2) ?? String(props.value)

  <section class="inspector">
    <button type="button" aria-expanded={String(expanded)} onClick={() => (expanded = !expanded)}>
      <span>{props.label}</span>
      <span aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    @if (expanded) {
      <pre>{serialized}</pre>
    }

    <style>
      .inspector {
        overflow: hidden;
        border: 1px solid var(--folio-line, #dce3df);
        border-radius: 14px;
        background: var(--folio-surface, #fffffc);
      }

      button {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        border: 0;
        background: transparent;
        color: var(--folio-ink, #17221e);
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 700;
      }

      pre {
        max-height: 280px;
        overflow: auto;
        margin: 0;
        padding: 14px;
        border-top: 1px solid var(--folio-line, #dce3df);
        color: var(--folio-muted, #66716c);
        font: 10px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
        white-space: pre-wrap;
      }
    </style>
  </section>
}
