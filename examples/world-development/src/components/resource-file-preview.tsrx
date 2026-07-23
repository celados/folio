import { effect, track } from 'ripple'
import { ResourceFile } from '@celados/folio-resources'
import { Inspector, StatusPanel } from '@celados/folio-ui'

import sampleUrl from '../assets/resource-file-sample.csv?url'
import htmlUrl from '../assets/resource-file-sample.html?url'
import svgUrl from '../assets/resource-file-sample.svg?url'
import xmlUrl from '../assets/resource-file-sample.xml?url'

type SampleRow = Readonly<{
  active: boolean
  city: string
  opened: Date
  trips: number
}>

type PreviewState =
  | Readonly<{ status: 'pending' }>
  | Readonly<{ detail: string; status: 'error' }>
  | Readonly<{ domSummary: string; rows: readonly SampleRow[]; status: 'ready' }>

const sampleFile = ResourceFile(sampleUrl, { name: 'resource-file-sample.csv' })
const htmlFile = ResourceFile(htmlUrl, { name: 'resource-file-sample.html' })
const imageFile = ResourceFile(svgUrl, { name: 'resource-file-sample.svg' })
const xmlFile = ResourceFile(xmlUrl, { name: 'resource-file-sample.xml' })

export function ResourceFilePreview() @{
  let &[state] = track<PreviewState>({ status: 'pending' })

  effect(() => {
    let active = true
    Promise.all([
      sampleFile.csv({ typed: 'auto' }),
      htmlFile.html(),
      imageFile.image({ alt: 'ResourceFile image fixture' }),
      xmlFile.xml(),
    ]).then(
      ([rows, html, image, xml]) => {
        if (active) {
          state = {
            domSummary: `${html.title} · ${image.alt} · ${xml.querySelector('city')?.textContent}`,
            rows: rows as unknown as readonly SampleRow[],
            status: 'ready',
          }
        }
      },
      (error: unknown) => {
        if (active) {
          state = {
            detail: error instanceof Error ? error.message : String(error),
            status: 'error',
          }
        }
      },
    )
    return () => {
      active = false
    }
  })

  <section class="resource-file-preview" aria-labelledby="resource-file-title">
    <div>
      <p class="eyebrow">ResourceFile · ordinary ESM asset</p>
      <h2 id="resource-file-title">Typed browser-side file readers</h2>
      <p>
        Vite emits the URL; Folio reads the installed asset without a registry, CDN parser, or
        Observable runtime.
      </p>
    </div>

    @switch (state.status) {
      @case 'ready': {
        <div class="resource-file-result">
          <strong data-resource-file-count>{`${state.rows.length} typed CSV rows`}</strong>
          <span>{`${sampleFile.name} · ${sampleFile.mimeType}`}</span>
          <span data-resource-dom>{state.domSummary}</span>
          <Inspector label="ResourceFile rows" value={state.rows} expandedDepth={1} />
        </div>
      }
      @case 'error': {
        <StatusPanel
          kind="error"
          title="Unable to read the ResourceFile"
          detail={state.detail}
        />
      }
      @default: {
        <StatusPanel kind="loading" title="Reading the ResourceFile" />
      }
    }

    <style>
      .resource-file-preview {
        display: grid;
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
        gap: 24px;
        margin-top: 18px;
        padding: 22px;
        border: 1px solid var(--folio-line, #dce3df);
        border-radius: 16px;
        background: var(--folio-surface, #fffffc);
      }

      .eyebrow {
        margin: 0 0 8px;
        color: var(--accent, #f05a3a);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h2 {
        margin: 0;
        font-family: var(--serif, Iowan Old Style, Baskerville, Georgia, serif);
        font-size: clamp(24px, 3vw, 36px);
        font-weight: 500;
        letter-spacing: -0.035em;
      }

      p {
        margin: 10px 0 0;
        color: var(--folio-muted, #66716c);
        font-size: 12px;
        line-height: 1.6;
      }

      .resource-file-result {
        display: grid;
        gap: 6px;
      }

      .resource-file-result > span {
        margin-bottom: 6px;
        color: var(--folio-muted, #66716c);
        font-size: 10px;
      }

      @media (max-width: 760px) {
        .resource-file-preview {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </section>
}
