import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CONTRACT_ADDRESS, REPO_URL, contractUrl, txUrl } from '../config'
import { PROOFS } from '../proofs'
import { correctedSet, statusOf, useLabels, useRecent, useSummary } from '../lib/ledger'
import { formatAed } from '../lib/money'
import { normaliseCode, shortAddr } from '../lib/format'
import { Card, EntryCard, EntryCardSkeleton, ErrorNotice, ExtLink, Skeleton } from '../components/ui'

export function ReceiptSearch({ initial = '', autoFocus = true }: { initial?: string; autoFocus?: boolean }) {
  const [code, setCode] = useState(initial)
  const navigate = useNavigate()
  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    const c = normaliseCode(code)
    if (c) navigate(`/check/${encodeURIComponent(c)}`)
  }
  return (
    <form onSubmit={submit} role="search" className="w-full">
      <label htmlFor="receipt" className="mb-1.5 block text-sm font-semibold text-slate-700">
        Receipt number
      </label>
      <div className="flex gap-2">
        <input
          id="receipt"
          name="receipt"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. EXP-0002"
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="min-h-14 w-full min-w-0 rounded-2xl border border-slate-300 bg-white px-4 font-mono text-lg uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
        />
        <button
          type="submit"
          className="min-h-14 shrink-0 rounded-2xl bg-emerald-700 px-6 text-lg font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Check
        </button>
      </div>
    </form>
  )
}

function Totals() {
  const s = useSummary()
  if (s.isError && !s.data) return <ErrorNotice onRetry={() => s.refetch()} />
  const d = s.data
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500">Balance</p>
      {d ? (
        <p data-testid="balance" className="mt-1 text-4xl font-bold tracking-tight text-slate-900 tabular-nums">
          {formatAed(d.balance)}
        </p>
      ) : (
        <Skeleton className="mt-1 h-10 w-56" />
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs font-medium text-slate-500">Money in</p>
          {d ? (
            <p className="mt-0.5 font-semibold text-emerald-700 tabular-nums">{formatAed(d.totalIncome)}</p>
          ) : (
            <Skeleton className="mt-1 h-5 w-28" />
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Money out</p>
          {d ? (
            <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">{formatAed(d.totalExpense)}</p>
          ) : (
            <Skeleton className="mt-1 h-5 w-28" />
          )}
        </div>
      </div>
    </Card>
  )
}

function Rules() {
  return (
    <section aria-labelledby="rules-h" data-testid="rules">
      <h2 id="rules-h" className="text-lg font-semibold text-slate-900">
        Rules this contract enforces
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Each rule has a real example of it letting something through and refusing something, on the public record.
      </p>
      <ol className="mt-3 space-y-3">
        {PROOFS.map((p) => (
          <li key={p.rule}>
            <Card className="p-4">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {p.rule}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{p.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{p.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={txUrl(p.passedTx)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center rounded-xl bg-green-50 px-3 text-sm font-semibold text-green-800 ring-1 ring-green-200 hover:bg-green-100"
                    >
                      ✓ Passed ↗
                    </a>
                    <a
                      href={txUrl(p.refusedTx)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center rounded-xl bg-red-50 px-3 text-sm font-semibold text-red-800 ring-1 ring-red-200 hover:bg-red-100"
                    >
                      ✗ Refused ↗
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Recent() {
  const r = useRecent(5)
  const label = useLabels((r.data ?? []).map((e) => e.poster))
  const corrected = correctedSet(r.data ?? [])
  return (
    <section aria-labelledby="recent-h">
      <div className="flex items-baseline justify-between">
        <h2 id="recent-h" className="text-lg font-semibold text-slate-900">
          Latest entries
        </h2>
        <Link to="/ledger" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700 underline underline-offset-2">
          See all entries
        </Link>
      </div>
      <div className="mt-2 space-y-2">
        {r.isError && !r.data ? (
          <ErrorNotice onRetry={() => r.refetch()} />
        ) : r.isPending ? (
          Array.from({ length: 5 }, (_, i) => <EntryCardSkeleton key={i} />)
        ) : r.data && r.data.length === 0 ? (
          <Card className="p-4 text-sm text-slate-600">Nothing has been recorded yet.</Card>
        ) : (
          r.data!.map((e) => <EntryCard key={e.id.toString()} e={e} status={statusOf(e, corrected)} label={label(e.poster)} />)
        )}
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
          Robotics Club Money — every dirham, on the record.
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Anyone can check it. Only the treasurer can add to it. Nobody can quietly change it.
        </p>
        <div className="mt-5">
          <ReceiptSearch />
        </div>
      </section>
      <Totals />
      <Rules />
      <Recent />
      <footer className="space-y-3 border-t border-slate-200 pt-6 text-sm text-slate-600">
        <h2 className="text-base font-semibold text-slate-900">How this works</h2>
        <p>
          <span className="font-medium text-slate-800">On the public record:</span> every entry, amount, receipt
          number, who recorded it and when, every correction and its reason, who is allowed to record money, and the
          balance.
        </p>
        <p>
          <span className="font-medium text-slate-800">Not on the public record:</span> the paper receipts and
          invoices themselves, the club's bank account, and how this website looks. The website only reads the record;
          it can't change it.
        </p>
        <p>
          The rulebook lives at <span className="font-mono text-xs text-slate-500">{shortAddr(CONTRACT_ADDRESS)}</span>{' '}
          · <ExtLink href={contractUrl}>View contract ↗</ExtLink> · <ExtLink href={REPO_URL}>Source code ↗</ExtLink>
        </p>
        <p className="text-xs text-slate-400">Demo for Hash It Out 2026. All names and amounts are fictional.</p>
      </footer>
    </div>
  )
}
