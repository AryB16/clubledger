import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { contractUrl } from '../config'
import { useLabels, useVersions, verdictOf, type Entry, type Verdict } from '../lib/ledger'
import { formatAed } from '../lib/money'
import { formatDateTime, normaliseCode } from '../lib/format'
import { Card, ErrorNotice, ExtLink, Person, Skeleton } from '../components/ui'
import { ReceiptSearch } from './Home'

const VERDICT: Record<Verdict, { headline: string; cls: string }> = {
  GENUINE: { headline: '✓ Genuine record', cls: 'bg-green-700 text-white' },
  CORRECTED: { headline: 'Corrected — see what changed', cls: 'bg-amber-400 text-amber-950' },
  CANCELLED: { headline: 'Cancelled', cls: 'bg-slate-500 text-white' },
  NOT_FOUND: { headline: '✗ No such record', cls: 'bg-red-700 text-white' },
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-slate-500">{k}</dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words text-slate-900">{v || '—'}</dd>
    </div>
  )
}

function Timeline({ versions, label }: { versions: Entry[]; label: (a: Entry['poster']) => string }) {
  const newestFirst = [...versions].reverse()
  return (
    <ol className="relative ml-2 border-l-2 border-slate-200">
      {newestFirst.map((v, i) => {
        const isOriginal = v.correctsId === 0n
        const isLatest = i === 0
        const n = versions.indexOf(v)
        return (
          <li key={v.id.toString()} className="relative pb-5 pl-5 last:pb-0" data-testid="version">
            <span
              className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white ${
                isLatest ? 'bg-slate-900' : 'bg-slate-300'
              }`}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-semibold text-slate-900">
                {isOriginal ? 'Original — kept forever' : `Correction ${n}`}
                {isLatest && versions.length > 1 && (
                  <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">Latest</span>
                )}
              </p>
              <p className={`font-semibold tabular-nums ${!isLatest ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {formatAed(v.amount)}
              </p>
            </div>
            {!isOriginal && <p className="mt-1 text-sm text-slate-700">“{v.reason}”</p>}
            <div className="mt-1.5 flex flex-wrap items-end justify-between gap-2 text-xs text-slate-500">
              <Person label={label(v.poster)} address={v.poster} />
              <span>{formatDateTime(v.timestamp)}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function Check() {
  const params = useParams()
  const raw = params.code ?? ''
  const code = normaliseCode(raw) // the router has already URL-decoded the param
  const q = useVersions(code)
  const versions = q.data ?? []
  const label = useLabels(versions.map((v) => v.poster))

  useEffect(() => {
    document.title = `${code} — ClubLedger`
  }, [code])

  if (q.isError && !q.data) {
    return (
      <div className="space-y-6">
        <ErrorNotice onRetry={() => q.refetch()} />
        <ReceiptSearch initial={code} autoFocus={false} />
      </div>
    )
  }

  if (q.isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <div className="-mx-4 px-4 py-7 sm:mx-0 sm:rounded-2xl bg-slate-100">
          <Skeleton className="h-4 w-24 bg-slate-200" />
          <Skeleton className="mt-2 h-8 w-64 bg-slate-200" />
          <Skeleton className="mt-3 h-4 w-full bg-slate-200" />
        </div>
        <Card className="p-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
      </div>
    )
  }

  const verdict = verdictOf(versions)
  const v = VERDICT[verdict]
  const original = versions[0]
  const latest = versions[versions.length - 1]
  const corrections = versions.length - 1

  return (
    <div className="space-y-6">
      <section
        data-testid="verdict"
        data-verdict={verdict}
        className={`-mx-4 px-4 py-6 sm:mx-0 sm:rounded-2xl ${v.cls}`}
      >
        <p className="font-mono text-sm font-semibold opacity-80">Receipt {code}</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight">{v.headline}</h1>
        {original ? (
          <p className="mt-2 text-sm opacity-90">
            Recorded by {label(original.poster)} · {formatDateTime(original.timestamp)} · cannot be edited ·{' '}
            {corrections} correction{corrections === 1 ? '' : 's'}
          </p>
        ) : (
          <p className="mt-2 text-sm opacity-90">
            No entry with this receipt number was ever recorded by this club's contract.
          </p>
        )}
        <a
          href={contractUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-2"
        >
          View public proof ↗
        </a>
      </section>

      {latest && (
        <>
          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900">
              {verdict === 'GENUINE' ? 'Details' : 'Details (latest version)'}
            </h2>
            <dl className="mt-2 divide-y divide-slate-100">
              <Row k="Type" v={latest.kind === 0 ? 'Income' : 'Expense'} />
              <Row
                k="Amount"
                v={<span className="text-lg font-bold tabular-nums">{formatAed(latest.amount)}</span>}
              />
              <Row k="Category" v={latest.category} />
              <Row k={latest.kind === 0 ? 'From' : 'Paid to'} v={latest.counterparty} />
              <Row k="Description" v={latest.description} />
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Every version</h2>
            <Timeline versions={versions} label={label} />
          </Card>
        </>
      )}

      <div>
        <p className="mb-2 text-sm text-slate-600">Check another receipt</p>
        <ReceiptSearch autoFocus={false} />
      </div>
      <p className="text-center text-xs text-slate-400">
        Read live from the club's public record · <ExtLink href={contractUrl} className="text-xs">View contract ↗</ExtLink>
      </p>
    </div>
  )
}
