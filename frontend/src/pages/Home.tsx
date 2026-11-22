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
      <label htmlFor="receipt" className={`mb-2 block text-sm font-semibold ${onDark ? 'text-navy-100' : 'text-ink'}`}>
        Receipt number
      </label>
      <div
        className={`flex items-center gap-2 rounded-full border bg-paper p-1.5 pl-5 focus-within:outline-3 focus-within:outline-offset-3 ${
          onDark ? 'border-transparent focus-within:outline-signal' : 'border-field focus-within:outline-navy-700'
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
          className="min-h-14 w-full min-w-0 bg-transparent code text-lg text-ink uppercase placeholder:text-muted placeholder:normal-case focus:outline-none focus-visible:outline-none"
        />
        <button type="submit" className="btn btn-signal min-h-14 shrink-0 text-lg">
          Check
        </button>
      </div>
      <p className={`mt-2.5 text-sm leading-snug ${onDark ? 'text-navy-100' : 'text-muted'}`}>
        Type the number printed on a receipt to see what was recorded and whether it was later corrected.
      </p>
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
        <p className="font-medium text-muted">Recorded club balance</p>
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
            <dd className="mt-1 h-6 font-semibold whitespace-nowrap text-gain tabular-nums">
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
        <p className="mt-4 text-sm leading-snug text-muted">
          Money in minus money out, after corrections. This is what treasurers recorded, not a bank balance.
        </p>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative">
      {/* On phones the green stops behind the slip, so the slip sits across the edge. */}
      <div aria-hidden className="band band-navy absolute inset-x-0 top-0 bottom-28 lg:bottom-0" style={{ position: 'absolute' }} />
      <div className="wrap relative grid gap-9 pt-9 pb-2 lg:grid-cols-[1.35fr_0.85fr] lg:items-center lg:gap-16 lg:py-14">
        <div className="on-dark text-white">
          <h1 className="max-w-2xl text-[2.6rem] leading-none font-extrabold tracking-tight sm:text-6xl">
            See the Robotics Club's <span className="text-signal">income and expenses.</span>
          </h1>
          <p className="mt-4 mb-6 max-w-lg text-lg leading-snug text-navy-100">
            The club's treasurers record each one on a public blockchain, where it can't be edited or deleted. Anyone can read the records for free, without an account.
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
    <section aria-labelledby="rules-h" data-testid="rules" className="wrap grid gap-7 pt-14 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10 lg:pt-24">
      <div>
        <h2 id="rules-h" className="text-4xl leading-none font-bold tracking-tight sm:text-5xl">
          The rules every entry must pass
        </h2>
        <p className="mt-3 max-w-sm leading-relaxed text-muted">
          A smart contract is a program on a public blockchain. This one is the club's rulebook: it checks each entry and refuses any that break these four rules. The buttons open real examples on BaseScan, an independent website for reading the blockchain.
        </p>
      </div>
      <ol className="sheet grid overflow-hidden sm:grid-cols-2">
        {PROOFS.map((p) => (
          <li
            key={p.rule}
            className="flex flex-col border-line p-5 not-first:border-t sm:p-6 sm:even:border-l sm:[&:nth-child(2)]:border-t-0"
          >
            <span aria-hidden className="font-display text-4xl font-extrabold text-navy-700/55">
              {p.rule}
            </span>
            <h3 className="mt-2 text-xl leading-tight font-bold">{p.title}</h3>
            <p className="mt-2 mb-4 text-muted">{p.description}</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <a href={txUrl(p.passedTx)} target="_blank" rel="noreferrer" className="btn min-h-11 gap-1.5 bg-gain-tint px-3 text-sm text-gain hover:bg-[#cde4da]">
                <Icon name="check" />
                See one allowed
              </a>
              <a href={txUrl(p.refusedTx)} target="_blank" rel="noreferrer" className="btn min-h-11 gap-1.5 bg-brick-tint px-3 text-sm text-brick hover:bg-[#eed2d2]">
                <Icon name="cross" />
                See one refused
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
    <section aria-labelledby="recent-h" className="wrap grid gap-6 py-14 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10 lg:py-24">
      <div>
        <h2 id="recent-h" className="text-4xl leading-none font-bold tracking-tight sm:text-5xl">
          Latest entries
        </h2>
        <p className="mt-3 max-w-sm leading-relaxed text-muted">
          The five most recent additions, including corrections. Select any line to see that receipt's full history.
        </p>
        <Link to="/ledger" className="mt-2 inline-flex min-h-11 items-center font-semibold text-navy-700 underline underline-offset-4">
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

const FAQ = [
  [
    'What is ClubLedger?',
    'A public record of a student club’s income and expenses. It shows every entry, amount, receipt number and date, who recorded it, any corrections with their reasons, and the resulting balance.',
  ],
  [
    'Who can change the records?',
    'Only treasurers approved by the Club Advisor can add an entry or a correction. Nobody can edit or delete what’s already saved, including the treasurers, the advisor and the developer of this website.',
  ],
  [
    'Do I have to trust this website?',
    'No. The website only displays the records. They are stored in a smart contract on a public blockchain, and you can read that contract yourself on BaseScan using the link below.',
  ],
  [
    'What can’t it prove?',
    'It can’t tell whether a treasurer typed the truth. The paper receipts and the club’s bank account aren’t part of the public record, so someone still has to compare those with what’s shown here.',
  ],
]

function HowItWorks() {
  return (
    <section aria-labelledby="how-h" className="band band-plain band-navy on-dark">
      <div className="wrap py-14 lg:py-20">
        <h2 id="how-h" className="text-4xl leading-none font-bold tracking-tight sm:text-5xl">
          How ClubLedger works
        </h2>
        <dl className="mt-8 grid gap-7 md:grid-cols-2 md:gap-x-14 md:gap-y-9">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <dt className="text-xl font-bold text-signal">{q}</dt>
              <dd className="mt-2 leading-relaxed text-navy-100">{a}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-white/15 pt-5 text-navy-100">
          <span>
            Contract <span className="code text-sm">{shortAddr(CONTRACT_ADDRESS)}</span>
          </span>
          <ExtLink href={contractUrl}>Read the contract on BaseScan</ExtLink>
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
