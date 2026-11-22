import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Address } from 'viem'
import type { Entry, Status } from '../lib/ledger'
import { formatAed } from '../lib/money'
import { formatDate, shortAddr } from '../lib/format'
import { Icon } from './icons'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`sheet ${className}`}>{children}</div>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-mist ${className}`} />
}

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="band band-navy on-dark">
      <div className="wrap pt-9 pb-10 sm:pt-14 sm:pb-14">
        <h1 className="text-4xl leading-[1.02] font-extrabold tracking-tight sm:text-6xl">{title}</h1>
        {children}
      </div>
    </section>
  )
}

export function ExtLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-11 items-center gap-1 font-semibold underline decoration-current/30 underline-offset-4 hover:decoration-current ${className}`}
    >
      {children}
      <Icon name="out" />
    </a>
  )
}

export const RPC_DOWN = "Can't reach the public record right now. Try again."

export function ErrorNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-brick/25 bg-brick-tint p-5 text-brick">
      <p className="font-medium">{RPC_DOWN}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-quiet">
          Try again
        </button>
      )}
    </div>
  )
}

/** Role label first, short address small and grey below (SPEC §3.2). */
export function Person({ label, address }: { label: string; address: Address }) {
  return (
    <span className="inline-flex flex-col leading-snug">
      <span className="font-medium text-ink">{label}</span>
      <span className="code text-xs text-muted">{shortAddr(address)}</span>
    </span>
  )
}

const STATUS_STYLE: Record<Status, string> = {
  Latest: 'text-muted',
  Corrected: 'bg-amber-100 px-2 text-amber-900',
  Correction: 'bg-amber-100 px-2 text-amber-900',
  Cancelled: 'bg-mist px-2 text-ink',
}

// "Latest" on its own didn't say latest of what.
const STATUS_TEXT: Record<Status, string> = {
  Latest: 'No changes',
  Corrected: 'Corrected',
  Correction: 'Correction',
  Cancelled: 'Cancelled',
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`rounded-md py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>{STATUS_TEXT[status]}</span>
}

export function Amount({ fils, kind }: { fils: bigint; kind: number }) {
  const sign = fils === 0n ? '' : kind === 0 ? '+' : '−'
  return (
    <span className={`font-semibold whitespace-nowrap tabular-nums sm:text-lg ${kind === 0 ? 'text-gain' : 'text-ink'}`}>
      {sign}
      {formatAed(fils)}
    </span>
  )
}

/** Entries read like lines on a bank statement: one sheet, one line each. */
export function Statement({ children }: { children: ReactNode }) {
  return <div className="sheet divide-y divide-line overflow-hidden">{children}</div>
}

export function EntryCard({ e, status, label }: { e: Entry; status: Status; label: string }) {
  return (
    <Link
      to={`/check/${encodeURIComponent(e.refCode)}`}
      data-testid="entry-card"
      className="grid min-h-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition-colors hover:bg-navy-50 focus-visible:-outline-offset-4 sm:min-h-24 sm:px-7"
    >
      <span className="min-w-0">
        <span className="block font-semibold break-words text-ink">{e.counterparty || e.category}</span>
        <span className="mt-1 block text-xs text-muted sm:text-sm">
          <span className="code font-semibold text-ink">{e.refCode}</span> · {e.category}
        </span>
        <span className="mt-0.5 block text-xs text-muted sm:text-sm">
          {formatDate(e.timestamp)}, {label}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <Amount fils={e.amount} kind={e.kind} />
        <span className="flex flex-wrap items-center justify-end gap-x-2 text-xs text-muted">
          {e.kind === 0 ? 'Income' : 'Expense'}
          <StatusBadge status={status} />
        </span>
      </span>
    </Link>
  )
}

export function EntryCardSkeleton() {
  return (
    <div className="flex min-h-28 items-center justify-between gap-3 px-4 py-4 sm:min-h-24 sm:px-7">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-24" />
    </div>
  )
}
