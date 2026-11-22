import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CONTRACT_ADDRESS, REPO_URL, contractUrl, txUrl } from '../config'
import { PROOFS } from '../proofs'
import { correctedSet, statusOf, useLabels, useRecent, useSummary } from '../lib/ledger'
import { formatAed } from '../lib/money'
import { normaliseCode, shortAddr } from '../lib/format'
import { Icon } from '../components/icons'
import { EntryCard, EntryCardSkeleton, ErrorNotice, ExtLink, Skeleton, Statement } from '../components/ui'

export function ReceiptSearch({ initial = '', autoFocus = true, onDark = false }: { initial?: string; autoFocus?: boolean; onDark?: boolean }) {
  const [code, setCode] = useState(initial)
  const navigate = useNavigate()
  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    const c = normaliseCode(code)
    if (c) navigate(`/check/${encodeURIComponent(c)}`)
  }
  return (
    <form onSubmit={submit} role="search" className="w-full max-w-lg">
      <label htmlFor="receipt" className={`mb-2 block text-sm font-semibold ${onDark ? 'text-forest-100' : 'text-ink'}`}>
        Receipt number
      </label>
      <div
        className={`flex items-center gap-2 rounded-full border bg-paper p-1.5 pl-5 focus-within:outline-3 focus-within:outline-offset-3 ${
          onDark ? 'border-transparent focus-within:outline-zest' : 'border-field focus-within:outline-forest-700'
        }`}
      >
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
          className="min-h-14 w-full min-w-0 bg-transparent font-mono text-lg text-ink uppercase placeholder:text-muted placeholder:normal-case focus:outline-none focus-visible:outline-none"
        />
        <button type="submit" className="btn btn-zest min-h-14 shrink-0 text-lg">
          Check
        </button>
      </div>
    </form>
  )
}

function BalanceSlip() {
  const s = useSummary()
  if (s.isError && !s.data) return <ErrorNotice onRetry={() => s.refetch()} />
  const d = s.data
  return (
    <div className="slip-shadow">
      <div className="slip px-6 pt-6 pb-8 sm:px-8 sm:pt-8 sm:pb-10">
        <p className="font-medium text-muted">Club balance</p>
        {d ? (
          <p data-testid="balance" className="mt-1 text-[2.5rem] leading-12 font-bold tracking-tight whitespace-nowrap tabular-nums sm:text-5xl sm:leading-14">
            {formatAed(d.balance)}
          </p>
        ) : (
          <Skeleton className="mt-1 h-12 w-56 sm:h-14" />
        )}
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-dashed border-field/60 pt-5">
          <div>
            <dt className="text-sm text-muted">Money in</dt>
            <dd className="mt-1 h-6 font-semibold whitespace-nowrap text-forest-700 tabular-nums">
              {d ? formatAed(d.totalIncome) : <Skeleton className="h-6 w-28" />}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Money out</dt>
            <dd className="mt-1 h-6 font-semibold whitespace-nowrap tabular-nums">
              {d ? formatAed(d.totalExpense) : <Skeleton className="h-6 w-28" />}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative">
      {/* On phones the green stops behind the slip, so the slip sits across the edge. */}
      <div aria-hidden className="band band-forest absolute inset-x-0 top-0 bottom-28 lg:bottom-0" style={{ position: 'absolute' }} />
      <div className="wrap relative grid gap-9 pt-9 pb-2 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-20 lg:py-24">
        <div className="on-dark text-white">
          <h1 className="max-w-xl text-[2.85rem] leading-[0.98] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Every dirham, <span className="text-zest">out in the open.</span>
          </h1>
          <p className="mt-4 mb-7 max-w-md text-lg leading-relaxed text-forest-100">
            See what the Robotics Club gets and spends, or look up any receipt.
          </p>
          <ReceiptSearch onDark />
        </div>
        <BalanceSlip />
      </div>
    </section>
  )
}

function Rules() {
  return (
    <section aria-labelledby="rules-h" data-testid="rules" className="wrap grid gap-7 pt-14 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16 lg:pt-24">
      <div>
        <h2 id="rules-h" className="text-4xl leading-none font-bold tracking-tight sm:text-5xl">
          The club's rulebook
        </h2>
        <p className="mt-3 max-w-sm leading-relaxed text-muted">
          A smart contract enforces these four rules. Open a real example of what it allowed, or what it refused.
        </p>
      </div>
      <ol className="sheet grid overflow-hidden sm:grid-cols-2">
        {PROOFS.map((p) => (
          <li
            key={p.rule}
            className="flex flex-col border-line p-5 not-first:border-t sm:p-7 sm:even:border-l sm:[&:nth-child(2)]:border-t-0"
          >
            <span aria-hidden className="font-display text-4xl font-extrabold text-forest-700/55">
              {p.rule}
            </span>
            <h3 className="mt-2 text-xl leading-tight font-bold">{p.title}</h3>
            <p className="mt-2 mb-4 text-muted">{p.description}</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <a href={txUrl(p.passedTx)} target="_blank" rel="noreferrer" className="btn min-h-11 bg-forest-50 px-4 text-sm text-forest-800 hover:bg-forest-100">
                <Icon name="check" />
                Passed
              </a>
              <a href={txUrl(p.refusedTx)} target="_blank" rel="noreferrer" className="btn min-h-11 bg-[#f9e5de] px-4 text-sm text-brick hover:bg-[#f3d5cb]">
                <Icon name="cross" />
                Refused
              </a>
            </div>
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
    <section aria-labelledby="recent-h" className="wrap grid gap-6 py-14 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16 lg:py-24">
      <div>
        <h2 id="recent-h" className="text-4xl leading-none font-bold tracking-tight sm:text-5xl">
          Latest entries
        </h2>
        <Link to="/ledger" className="mt-2 inline-flex min-h-11 items-center font-semibold text-forest-700 underline underline-offset-4">
          See all entries
        </Link>
      </div>
      {r.isError && !r.data ? (
        <ErrorNotice onRetry={() => r.refetch()} />
      ) : (
        <Statement>
          {r.isPending ? (
            Array.from({ length: 5 }, (_, i) => <EntryCardSkeleton key={i} />)
          ) : r.data && r.data.length === 0 ? (
            <p className="p-6 text-muted">Nothing has been recorded yet.</p>
          ) : (
            r.data!.map((e) => <EntryCard key={e.id.toString()} e={e} status={statusOf(e, corrected)} label={label(e.poster)} />)
          )}
        </Statement>
      )}
    </section>
  )
}

function HowItWorks() {
  return (
    <section aria-labelledby="how-h" className="band band-plain band-forest on-dark">
      <div className="wrap py-14 lg:py-20">
        <h2 id="how-h" className="text-4xl leading-none font-bold tracking-tight sm:text-5xl">
          How this works
        </h2>
        <div className="mt-8 grid gap-7 md:grid-cols-2 md:gap-14">
          <div>
            <h3 className="text-xl font-bold text-zest">What's public</h3>
            <p className="mt-2 leading-relaxed text-forest-100">
              Every entry, amount and receipt number. Who recorded it and when. Each correction with its reason, the list
              of treasurers, and the balance.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold text-zest">What isn't</h3>
            <p className="mt-2 leading-relaxed text-forest-100">
              The paper receipts and invoices, and the club's bank account. This website's design isn't part of the record
              either. The site reads the record and has no power to change past entries.
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-white/15 pt-5 text-forest-100">
          <span>
            Contract <span className="font-mono text-sm">{shortAddr(CONTRACT_ADDRESS)}</span>
          </span>
          <ExtLink href={contractUrl}>View contract</ExtLink>
          <ExtLink href={REPO_URL}>Source code</ExtLink>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Rules />
      <Recent />
      <HowItWorks />
    </>
  )
}
