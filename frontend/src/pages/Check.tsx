import { useEffect, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { contractUrl } from '../config'
import { useLabels, useVersions, verdictOf, type Entry, type Verdict } from '../lib/ledger'
import { formatAed } from '../lib/money'
import { formatDateTime, normaliseCode } from '../lib/format'
import { Icon } from '../components/icons'
import { Card, ErrorNotice, ExtLink, Person, Skeleton } from '../components/ui'
import { ReceiptSearch } from './Home'

const VERDICT: Record<Verdict, { headline: string; band: string; icon: 'check' | 'pencil' | 'minus' | 'cross' }> = {
  GENUINE: { headline: 'Genuine record', band: 'band-genuine on-dark', icon: 'check' },
  CORRECTED: { headline: 'Corrected', band: 'band-corrected', icon: 'pencil' },
  CANCELLED: { headline: 'Cancelled', band: 'band-cancelled on-dark', icon: 'minus' },
  NOT_FOUND: { headline: 'No such record', band: 'band-refused on-dark', icon: 'cross' },
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{v || 'Not given'}</dd>
    </div>
  )
}

function Timeline({ versions, label }: { versions: Entry[]; label: (a: Entry['poster']) => string }) {
  const newestFirst = [...versions].reverse()
  return (
    <ol>
      {newestFirst.map((v, i) => {
        const isOriginal = v.correctsId === 0n
        const isLatest = i === 0
        const n = versions.indexOf(v)
        return (
          <li key={v.id.toString()} className="relative pb-7 pl-8 last:pb-0" data-testid="version">
            {i < newestFirst.length - 1 && <span aria-hidden className="absolute top-5 bottom-0 left-[7px] border-l-2 border-dashed border-field/60" />}
            <span
              aria-hidden
              className={`absolute top-1 left-0 h-4 w-4 rounded-full border-[3px] ${
                isLatest ? 'border-forest-900 bg-zest' : 'border-field bg-paper'
              }`}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-semibold">
                {isOriginal ? 'Original entry' : `Correction ${n}`}
                {isLatest && versions.length > 1 && (
                  <span className="ml-2 rounded-md bg-forest-900 px-2 py-0.5 text-xs font-semibold text-white">Latest</span>
                )}
              </p>
              <p className={`text-lg font-semibold whitespace-nowrap tabular-nums ${isLatest ? '' : 'text-muted line-through'}`}>
                {formatAed(v.amount)}
              </p>
            </div>
            {!isOriginal && <p className="mt-2 rounded-xl bg-sand/65 px-3 py-2 leading-snug">{v.reason}</p>}
            <div className="mt-2 flex flex-wrap items-end justify-between gap-2 text-sm text-muted">
              <Person label={label(v.poster)} address={v.poster} />
              <span className="text-xs">{formatDateTime(v.timestamp)}</span>
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
    document.title = `${code} | ClubLedger`
    return () => {
      document.title = 'ClubLedger | Robotics Club money'
    }
  }, [code])

  if (q.isError && !q.data) {
    return (
      <div className="wrap space-y-6 py-10">
        <ErrorNotice onRetry={() => q.refetch()} />
        <ReceiptSearch initial={code} autoFocus={false} />
      </div>
    )
  }

  if (q.isPending) {
    return (
      <div aria-busy>
        <div className="band band-forest">
          {/* Same heights as the real verdict band, so nothing jumps when the record arrives. */}
          <div className="wrap pt-9 pb-16 sm:pt-14 sm:pb-20">
            <Skeleton className="h-6 w-40 bg-white/15" />
            <Skeleton className="mt-2 h-11 w-64 bg-white/15 sm:h-18" />
            <Skeleton className="mt-4 h-19.5 w-full max-w-xl bg-white/15 sm:h-[3.66rem]" />
            <div className="mt-2 h-11" />
          </div>
        </div>
        <div className="wrap relative -mt-7">
          <Card className="p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-4 h-40 w-full" />
          </Card>
        </div>
      </div>
    )
  }

  const verdict = verdictOf(versions)
  const v = VERDICT[verdict]
  const original = versions[0]
  const latest = versions[versions.length - 1]
  const corrections = versions.length - 1

  return (
    <>
      <section data-testid="verdict" data-verdict={verdict} className={`band ${v.band}`}>
        <div className="wrap pt-9 pb-16 sm:pt-14 sm:pb-20">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono font-semibold break-all">Receipt {code}</p>
              <h1 className="mt-2 text-[2.75rem] leading-none font-extrabold tracking-tight sm:text-7xl">{v.headline}</h1>
            </div>
            <span aria-hidden className="grid h-14 w-14 shrink-0 -rotate-6 place-items-center rounded-full border-[3px] border-current sm:h-24 sm:w-24 sm:border-4">
              <Icon name={v.icon} className="h-7 w-7 sm:h-12 sm:w-12" />
            </span>
          </div>
          {original ? (
            <p className="mt-4 min-h-19.5 max-w-2xl leading-relaxed sm:min-h-[3.66rem] sm:text-lg">
              <span className="sm:block">
                Recorded by {label(original.poster)} on {formatDateTime(original.timestamp)}.
              </span>{' '}
              It can't be edited.{' '}
              {corrections === 0 ? 'No corrections.' : `${corrections} correction${corrections === 1 ? '' : 's'}, shown below.`}
            </p>
          ) : (
            <p className="mt-4 max-w-2xl leading-relaxed sm:text-lg">
              No entry with this receipt number was ever recorded by this club's contract.
            </p>
          )}
          <ExtLink href={contractUrl} className="mt-2">
            View public proof
          </ExtLink>
        </div>
      </section>

      {latest && (
        <div className="wrap relative z-10 -mt-7 grid items-start gap-5 md:grid-cols-2">
          <Card className="p-5 sm:p-7">
            <h2 className="text-2xl font-bold">{verdict === 'GENUINE' ? 'Details' : 'Details (latest version)'}</h2>
            <dl className="mt-3 divide-y divide-dashed divide-line">
              <Row k="Amount" v={<span className="text-2xl font-bold whitespace-nowrap tabular-nums">{formatAed(latest.amount)}</span>} />
              <Row k="Type" v={latest.kind === 0 ? 'Income' : 'Expense'} />
              <Row k="Category" v={latest.category} />
              <Row k={latest.kind === 0 ? 'From' : 'Paid to'} v={latest.counterparty} />
              <Row k="Description" v={latest.description} />
            </dl>
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="mb-5 text-2xl font-bold">Every version</h2>
            <Timeline versions={versions} label={label} />
          </Card>
        </div>
      )}

      <div className="wrap py-12 sm:py-16">
        <h2 className="mb-4 text-2xl font-bold">Check another receipt</h2>
        <ReceiptSearch autoFocus={false} />
        <p className="mt-4 flex flex-wrap items-center gap-x-4 text-sm text-muted">
          This page reads straight from the public record.
          <ExtLink href={contractUrl} className="text-forest-700">
            View contract
          </ExtLink>
        </p>
      </div>
    </>
  )
}
