import type { StatusPanelProps } from './types.ts'

export function StatusPanel(props: StatusPanelProps) @{
  <section
    class={`status ${props.kind}`}
    role={props.kind === 'error' ? 'alert' : 'status'}
    aria-live="polite"
  >
    <strong>{props.title}</strong>
    @if (props.detail) {
      <span>{props.detail}</span>
    }

    <style>
      .status {
        display: grid;
        gap: 4px;
        padding: 16px;
        border: 1px solid var(--folio-line, #dce3df);
        border-radius: 14px;
        background: var(--folio-surface, #fffffc);
        color: var(--folio-ink, #17221e);
      }

      .error {
        border-color: #efb3a8;
        background: #fff6f4;
      }

      span {
        color: var(--folio-muted, #66716c);
        font-size: 12px;
      }
    </style>
  </section>
}
