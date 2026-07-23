import { track } from 'ripple'

import type { DownloadButtonProps } from './types.ts'

export function DownloadButton(props: DownloadButtonProps) @{
  let &[busy] = track(false)
  let &[failure] = track<string | undefined>(undefined)

  async function download() {
    if (busy) return
    busy = true
    failure = undefined
    try {
      const blob = await (typeof props.source === 'function' ? props.source() : props.source)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = props.filename
      anchor.hidden = true
      document.body.append(anchor)
      try {
        anchor.click()
      } finally {
        anchor.remove()
        // Notebook Kit@7602ed2b also waits a frame so the browser consumes the URL before cleanup.
        requestAnimationFrame(() => URL.revokeObjectURL(url))
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
      props.onError?.(error)
    } finally {
      busy = false
    }
  }

  <span class="folio-download">
    <button type="button" disabled={busy} aria-busy={String(busy)} onClick={download}>
      {busy ? props.busyLabel ?? 'Preparing download…' : props.label ?? 'Download'}
    </button>
    @if (failure) {
      <span class="folio-download-error" role="alert">{failure}</span>
    }

    <style>
      .folio-download {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 9px;
      }

      button {
        min-height: 40px;
        padding: 0 18px;
        border: 0;
        border-radius: 999px;
        background: var(--folio-action, #12a594);
        color: white;
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 750;
      }

      button:hover:not(:disabled) {
        filter: brightness(0.94);
      }

      button:focus-visible {
        outline: 2px solid var(--folio-action, #12a594);
        outline-offset: 2px;
      }

      button:disabled {
        cursor: progress;
        opacity: 0.65;
      }

      .folio-download-error {
        color: var(--folio-error, #a33a2b);
        font-size: 11px;
      }
    </style>
  </span>
}
