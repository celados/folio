import { track } from 'ripple'

import { describeInspectorValue } from './inspector-model.ts'
import type { InspectorProps } from './types.ts'

// Capability baseline: observablehq/notebook-kit@7602ed2b inspect state, without implicit display.
type InspectorNodeProps = Readonly<{
  ancestors: readonly object[]
  depth: number
  expandedDepth: number
  label: string
  path: string
  value: unknown
}>

export function Inspector(props: InspectorProps) {
  return <section class="folio-inspector" aria-label={props.label}>
    <div role="tree">
      <InspectorNode
        ancestors={[]}
        depth={0}
        expandedDepth={props.expandedDepth ?? 0}
        label={props.label}
        path="root"
        value={props.value}
      />
    </div>

    <style>
      .folio-inspector {
        overflow: auto;
        max-height: var(--folio-inspector-max-height, 32rem);
        border: 1px solid var(--folio-line, #dce3df);
        border-radius: 12px;
        background: var(--folio-surface, #fffffc);
        color: var(--folio-ink, #17221e);
        font: 11px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .folio-inspector-node {
        min-width: max-content;
      }

      .folio-inspector-row {
        display: flex;
        min-height: 25px;
        align-items: baseline;
        padding: 2px 10px;
        padding-left: calc(10px + var(--folio-inspector-depth) * 16px);
      }

      .folio-inspector-row:hover {
        background: var(--folio-selected, #f0f7f4);
      }

      .folio-inspector-toggle {
        display: inline-grid;
        width: 16px;
        height: 16px;
        margin: 0 3px 0 -2px;
        padding: 0;
        place-content: center;
        border: 0;
        background: transparent;
        color: var(--folio-muted, #66716c);
        cursor: pointer;
        font: inherit;
      }

      .folio-inspector-spacer {
        display: inline-block;
        width: 17px;
      }

      .folio-inspector-key {
        margin-right: 7px;
        color: var(--folio-inspector-key, #745c27);
      }

      .folio-inspector-value {
        color: var(--folio-muted, #66716c);
      }

      [data-inspector-kind='string'] .folio-inspector-value {
        color: var(--folio-inspector-string, #276a52);
      }

      [data-inspector-kind='number'] .folio-inspector-value,
      [data-inspector-kind='bigint'] .folio-inspector-value {
        color: var(--folio-inspector-number, #315ea8);
      }

      [data-inspector-kind='error'] .folio-inspector-value {
        color: var(--folio-error, #a33a2b);
      }

      [data-inspector-kind='circular'] .folio-inspector-value {
        color: var(--folio-inspector-circular, #8a5a9b);
        font-style: italic;
      }
    </style>
  </section>
}

function InspectorNode(props: InspectorNodeProps) @{
  let &[descriptor] = track(() => describeInspectorValue(props.value, props.ancestors))
  let &[expandable] = track(() => descriptor.children.length > 0)
  let &[expanded] = track(expandable && props.depth < props.expandedDepth)
  let &[nextAncestors] = track(() =>
    isObject(props.value) && descriptor.kind !== 'circular'
      ? [...props.ancestors, props.value]
      : props.ancestors,
  )

  <div
    class="folio-inspector-node"
    data-inspector-kind={descriptor.kind}
    role="treeitem"
    aria-expanded={expandable ? String(expanded) : undefined}
  >
    <div
      class="folio-inspector-row"
      style={{ '--folio-inspector-depth': String(props.depth) }}
    >
      @if (expandable) {
        <button
          class="folio-inspector-toggle"
          type="button"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${props.label}`}
          aria-expanded={String(expanded)}
          data-inspector-path={props.path}
          onClick={() => (expanded = !expanded)}
        >{expanded ? '▾' : '▸'}</button>
      } @else {
        <span class="folio-inspector-spacer" aria-hidden="true"></span>
      }
      <span class="folio-inspector-key">{props.label}</span>
      <span class="folio-inspector-value">{descriptor.summary}</span>
    </div>
    @if (expanded) {
      <div role="group">
        @for (let child of descriptor.children; key child.pathPart) {
          <InspectorNode
            ancestors={nextAncestors}
            depth={props.depth + 1}
            expandedDepth={props.expandedDepth}
            label={child.key}
            path={`${props.path}.${child.pathPart}`}
            value={child.value}
          />
        }
      </div>
    }
  </div>
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function'
}
