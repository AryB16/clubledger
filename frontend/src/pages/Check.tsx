import { useEffect, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { contractUrl } from '../config'
import { useLabels, useVersions, verdictOf, type Entry, type Verdict } from '../lib/ledger'
import { formatAed } from '../lib/money'
import { formatDateTime, normaliseCode, shownName } from '../lib/format'
import { Icon } from '../components/icons'
import { Card, DemoMark, ErrorNotice, ExtLink, Person, Skeleton } from '../components/ui'
import { ReceiptSearch } from './Home'

const VERDICT: Record<Verdict, { headline: string; band: string; icon: 'check' | 'pencil' | 'minus' | 'cross' }> = {
  GENUINE: { headline: 'Genuine record', band: 'band-genuine on-dark', icon: 'check' },
  CORRECTED: { headline: 'Corrected', band: 'band-corrected', icon: 'pencil' },
  CANCELLED: { headline: 'Cancelled', band: 'band-cancelled on-dark', icon: 'minus' },
  NOT_FOUND: { headline: 'No such record', band: 'band-refused on-dark', icon: 'cross' },
}

/** One or two sentences that make sense to someone who arrived straight from a QR code. */
function explain(verdict: Verdict, versions: Entry[]) {
  if (verdict === 'NOT_FOUND') return "No entry with this receipt number was ever recorded by this club's contract."
  if (verdict === 'GENUINE')
    return "A treasurer recorded this receipt and it hasn't been changed since. This confirms what was recorded, not that the payment itself happened."
  const first = formatAed(versions[0].amount)
  const now = formatAed(versions[versions.length - 1].amount)
  if (verdict === 'CANCELLED')
    return `First recorded as ${first}, then cancelled by a treasurer. It no longer counts towards the balance, but its history stays.`
  return first === now
    ? `A treasurer corrected the details after recording it. The amount is still ${now}. Each version is kept below.`
    : `First recorded as ${first}, then corrected to ${now}. Both the old and new amounts are kept below, with the reason.`
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 text-right font-medium [overflow-wrap:anywhere]">{v || 'Not given'}</dd>
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
                isLatest ? 'border-navy-900 bg-signal' : 'border-field bg-paper'
              }`}
            />
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">
                {isOriginal ? 'Original entry' : `Correction ${n}`}
                {isLatest && versions.length > 1 && (
                  <span className="mt-1 block w-fit rounded-md bg-navy-900 px-2 py-0.5 text-xs font-semibold text-white">Current</span>
                )}
              </p>
              <p className={`text-lg font-semibold whitespace-nowrap tabular-nums ${isLatest ? '' : 'text-muted line-through'}`}>
                {formatAed(v.amount)}
              </p>
            </div>
            {!isOriginal && (
              <p className="mt-2 rounded-xl bg-mist/65 px-3 py-2 leading-snug">
                <span className="block text-xs font-semibold text-muted">Reason for this correction</span>
                {v.reason}
              </p>
            )}
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
      document.title = 'ClubLedger | Robotics Club income and expenses'
    }
  }, [code])

  if (q.isError && !q.data) {
    return (
      <div className="wrap space-y-6 py-10">
        <ErrorNotice onRetry={() => q.refetch()} />
        <ReceiptSearch initial={code} />
      </div>
    )
  }

  if (q.isPending) {
    return (
      <div aria-busy>
        <div className="band band-navy">
          {/* Same heights as the real verdict band, so nothing jumps when the record arrives. */}
          <div className="wrap pt-9 pb-16 sm:pt-14 sm:pb-20">
            <Skeleton className="h-6 w-40 bg-white/15" />
            <Skeleton className="mt-2 h-11 w-64 bg-white/15 sm:h-18" />
            <Skeleton className="mt-4 h-19.5 w-full max-w-xl bg-white/15 sm:h-[3.66rem]" />
            <Skeleton className="mt-3 h-10 w-full max-w-md bg-white/15 sm:h-5" />
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
              <p className="code font-semibold break-all">Receipt {code}</p>
              <h1 className="mt-2 text-[2.75rem] leading-none font-extrabold tracking-tight sm:text-7xl">{v.headline}</h1>
            </div>
            <span aria-hidden className="grid h-14 w-14 shrink-0 -rotate-6 place-items-center rounded-full border-[3px] border-current sm:h-24 sm:w-24 sm:border-4">
              <Icon name={v.icon} className="h-7 w-7 sm:h-12 sm:w-12" />
            </span>
          </div>
          <p className="mt-4 min-h-19.5 max-w-2xl leading-relaxed sm:min-h-[3.66rem] sm:text-lg">{explain(verdict, versions)}</p>
          {original ? (
            <p className="mt-3 min-h-10 max-w-3xl text-sm leading-5 sm:min-h-5">
              Recorded by {label(original.poster)} on {formatDateTime(original.timestamp)}, with{' '}
              {corrections === 0 ? 'no corrections' : `${corrections} correction${corrections === 1 ? '' : 's'}`}. Saved entries can't
              be edited.
            </p>
          ) : (
            <p className="mt-3 min-h-10 max-w-3xl text-sm leading-5 sm:min-h-5">
              Check the number for typing mistakes. If it matches your receipt, ask the club's treasurer why it's missing.
            </p>
          )}
          <ExtLink href={contractUrl} className="mt-2">
            View public proof on BaseScan
          </ExtLink>
        </div>
      </section>

      {latest && (
        <div className="wrap relative z-10 -mt-7 grid items-start gap-5 md:grid-cols-2">
          <Card className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-bold">{verdict === 'GENUINE' ? 'What was recorded' : 'Current version'}</h2>
              <DemoMark />
            </div>
            <dl className="mt-3 divide-y divide-dashed divide-line">
              <Row k="Amount" v={<span className="text-2xl font-bold whitespace-nowrap tabular-nums">{formatAed(latest.amount)}</span>} />
              <Row k="Type" v={latest.kind === 0 ? 'Income' : 'Expense'} />
              <Row k="Category" v={latest.category} />
              <Row k={latest.kind === 0 ? 'From' : 'Paid to'} v={shownName(latest.counterparty)} />
              <Row k="Description" v={latest.description} />
            </dl>
          </Card>

          <Card className="p-5 sm:p-7">
            <h2 className="mb-5 text-2xl font-bold">History of this receipt</h2>
            <Timeline versions={versions} label={label} />
          </Card>
        </div>
      )}

      <div className="wrap py-12 sm:py-16">
        <h2 className="mb-4 text-2xl font-bold">Check another receipt</h2>
        <ReceiptSearch />
        <p className="mt-4 flex flex-wrap items-center gap-x-4 text-sm text-muted">
          This page reads the public record directly, not a copy kept by this website.
          <ExtLink href={contractUrl} className="text-navy-700">
            Read the contract on BaseScan
          </ExtLink>
        </p>
      </div>
    </>
  )
}
