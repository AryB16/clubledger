import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { BookLine } from '../lib/book'
import { statusOf } from '../lib/ledger'
import { formatDate, shownName } from '../lib/format'
import { formatAed, formatFigure } from '../lib/money'
import { Skeleton, StatusBadge } from './ui'

const COLUMNS = ['Date', 'Receipt', 'Paid to / from', 'Category', 'In', 'Out', 'Balance', 'Status']
const FIGURES = new Set(['In', 'Out', 'Balance'])

function Figure({ name, value }: { name: 'In' | 'Out'; value: bigint | undefined }) {
  return (
    <td role="cell" className={`num c-${name.toLowerCase()} ${value === undefined ? 'c-none' : 'font-semibold'}`}>
      {value !== undefined && (
        <>
          <span className="lbl">{name} </span>
          {formatFigure(value)}
        </>
      )}
    </td>
  )
}

function Row({ line, corrected }: { line: BookLine; corrected: Set<bigint> }) {
  const navigate = useNavigate()
  const { entry: e, was } = line
  const to = `/check/${encodeURIComponent(e.refCode)}`
  // The link serves keyboard and screen readers. The rest of the row is the same target for a pointer.
  const open = (ev: MouseEvent) => {
    if ((ev.target as Element).closest('a') || window.getSelection()?.toString()) return
    if (ev.metaKey || ev.ctrlKey) window.open(to, '_blank', 'noopener')
    else navigate(to)
  }
  return (
    <tr role="row" data-testid="entry-card" className="book-row" onClick={open}>
      <td role="cell" className="c-date">{formatDate(e.timestamp)}</td>
      <td role="cell" className="c-receipt">
        <Link to={to} className="code font-semibold text-navy-700 underline decoration-navy-700/30 underline-offset-4">
          {e.refCode}
        </Link>
      </td>
      <td role="cell" className="c-payee">
        {shownName(e.counterparty) || 'Not given'}
        {was !== undefined && (
          <span className="block text-sm font-normal text-muted">
            Was {formatFigure(was)}, now {formatFigure(e.amount)}
          </span>
        )}
      </td>
      <td role="cell" className="c-category">{e.category}</td>
      <Figure name="In" value={line.moneyIn} />
      <Figure name="Out" value={line.moneyOut} />
      <td role="cell" className="num c-balance" data-testid="running-balance">
        <span className="lbl">Balance </span>
        {formatFigure(line.balance)}
      </td>
      <td role="cell" className="c-status">
        <StatusBadge status={statusOf(e, corrected)} />
      </td>
    </tr>
  )
}

/** The last `show` lines in the order they were recorded, so the table reads down to the recorded balance. */
export function LedgerTable({ lines, corrected, show }: { lines: BookLine[] | undefined; corrected: Set<bigint> | undefined; show: number }) {
  const rows = lines?.slice(-show)
  const before = lines && lines.length > show ? lines[lines.length - show - 1].balance : 0n
  return (
    <table role="table" className="book" aria-labelledby="recent-h" aria-busy={!lines}>
      <thead role="rowgroup">
        <tr role="row">
          {COLUMNS.map((c) => (
            <th key={c} role="columnheader" scope="col" className={FIGURES.has(c) ? 'num' : ''}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        <tr role="row" className="book-total text-muted">
          <th role="rowheader" scope="row" colSpan={6}>Balance brought forward</th>
          <td role="cell" className="num">{rows ? formatFigure(before) : <Skeleton className="h-5 w-20" />}</td>
          <td role="cell" />
        </tr>
        {rows && corrected
          ? rows.map((line) => <Row key={line.entry.id.toString()} line={line} corrected={corrected} />)
          : Array.from({ length: show }, (_, i) => (
              <tr key={i} role="row" className="book-row">
                <td role="cell" colSpan={8} className="col-span-2">
                  <Skeleton className="h-10 w-full" />
                </td>
              </tr>
            ))}
        {rows?.length === 0 && (
          <tr role="row" className="book-total text-muted">
            <td role="cell" colSpan={8}>Nothing has been recorded yet.</td>
          </tr>
        )}
      </tbody>
      <tfoot role="rowgroup">
        <tr role="row" className="book-total">
          <th role="rowheader" scope="row" colSpan={5}>Recorded club balance</th>
          <td role="cell" colSpan={2} className="num text-lg" data-testid="closing-balance">
            {lines ? formatAed(lines.at(-1)?.balance ?? 0n) : <Skeleton className="h-7 w-32" />}
          </td>
          <td role="cell" />
        </tr>
      </tfoot>
    </table>
  )
}
