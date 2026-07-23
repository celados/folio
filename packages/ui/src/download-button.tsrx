import type { DownloadButtonProps } from './types.ts'

export function DownloadButton(props: DownloadButtonProps) @{
  const download = () => {
    const url = URL.createObjectURL(new Blob([props.content()], { type: props.mediaType }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = props.filename()
    anchor.click()
    URL.revokeObjectURL(url)
  }

  <>
    <button type="button" onClick={download}>{props.label}</button>

    <style>
      button {
        min-height: 48px;
        padding: 0 20px;
        border: 0;
        border-radius: 999px;
        background: var(--folio-action, #12a594);
        color: white;
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 750;
      }
    </style>
  </>
}
