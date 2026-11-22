import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Address } from 'viem'
import type { Entry, Status } from '../lib/ledger'
import { formatAed } from '../lib/money'
import { formatDate, shortAddr } from '../lib/format'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</div>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
}

export function ExtLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-700 ${className}`}
    >
      {children}
    </a>
  )
}

export const RPC_DOWN = "Can't reach the public record right now — try again"

export function ErrorNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
      <p className="text-sm font-medium">{RPC_DOWN}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="min-h-11 rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-900 hover:bg-red-100"
        >
          Try again
        </button>
      )}
    </div>
  )
}

/** Role label first, short address small and grey below (SPEC §3.2). */
export function Person({ label, address }: { label: string; address: Address }) {
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="font-medium text-slate-800">{label}</span>
      <span className="font-mono text-xs text-slate-400">{shortAddr(address)}</span>
    </span>
  )
}

export function KindBadge({ kind }: { kind: number }) {
  return kind === 0 ? (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
      Income
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
      Expense
    </span>
  )
}

const STATUS_STYLE: Record<Status, string> = {
  Latest: 'bg-white text-slate-600 ring-slate-200',
  Corrected: 'bg-amber-50 text-amber-800 ring-amber-200',
  Correction: 'bg-amber-50 text-amber-800 ring-amber-200',
  Cancelled: 'bg-slate-100 text-slate-600 ring-slate-300',
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLE[status]}`}>{status}</span>
}

export function Amount({ fils, kind, className = '' }: { fils: bigint; kind: number; className?: string }) {
  return (
    <span className={`font-semibold tabular-nums ${kind === 0 ? 'text-emerald-700' : 'text-slate-900'} ${className}`}>
      {kind === 0 ? '+' : '−'} {formatAed(fils)}
    </span>
  )
}

export function EntryCard({ e, status, label }: { e: Entry; status: Status; label: string }) {
  return (
    <Link
      to={`/check/${encodeURIComponent(e.refCode)}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600"
      data-testid="entry-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-900">{e.refCode}</span>
            <KindBadge kind={e.kind} />
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm break-words text-slate-600">
            {e.category}
            {e.counterparty ? ` · ${e.counterparty}` : ''}
          </p>
        </div>
        <Amount fils={e.amount} kind={e.kind} className="shrink-0 text-right" />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{formatDate(e.timestamp)}</span>
        <span>{label}</span>
      </div>
    </Link>
  )
}

export function EntryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="mt-2 h-4 w-52" />
      <Skeleton className="mt-3 h-3 w-full" />
    </div>
  )
}
