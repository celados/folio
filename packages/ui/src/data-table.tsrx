import type { DataTableProps } from './types.ts'

export function DataTable<TRow>(props: DataTableProps<TRow>) @{
  <div class="folio-table-scroll">
    <table>
      <caption>{props.caption}</caption>
      <thead>
        <tr>
          @for (let column of props.columns) {
            <th class={column.align === 'right' ? 'number' : ''}>{column.label}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (let row of props.rows) {
          <tr
            data-row-key={props.rowKey(row)}
            class={props.isSelected?.(row) ? 'selected' : ''}
            onClick={() => props.onSelect?.(row)}
          >
            @for (let column of props.columns) {
              <td class={column.align === 'right' ? 'number' : ''}>{column.value(row)}</td>
            }
          </tr>
        }
      </tbody>
    </table>

    <style>
      .folio-table-scroll {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        color: var(--folio-ink, #17221e);
        font-family: inherit;
        font-size: 11px;
      }

      caption {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }

      th,
      td {
        padding: 13px 18px;
        border-bottom: 1px solid var(--folio-line, #dce3df);
        text-align: left;
        white-space: nowrap;
      }

      .number {
        text-align: right;
      }

      thead th {
        color: var(--folio-muted, #66716c);
        font-size: 9px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      tbody tr {
        cursor: pointer;
      }

      tbody tr:hover,
      tbody tr.selected {
        background: var(--folio-selected, #f0f7f4);
      }

      tbody tr:last-child td {
        border-bottom: 0;
      }
    </style>
  </div>
}
