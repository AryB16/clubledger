import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CONTRACT_ADDRESS, REPO_URL, contractUrl, txUrl } from '../config'
import { PROOFS } from '../proofs'
import { useBook, useVersions, verdictOf, type Verdict } from '../lib/ledger'
import { formatAed } from '../lib/money'
import { formatDateTime, normaliseCode } from '../lib/format'
import { Icon } from '../components/icons'
import { useTourEvent } from '../tour/events'
import { EXAMPLE_CODE } from '../tour/steps'
import { LedgerTable } from '../components/LedgerTable'
import { DemoMark, ErrorNotice, ExtLink, Skeleton } from '../components/ui'

export function ReceiptSearch({ initial = '', onDark = false }: { initial?: string; onDark?: boolean }) {
  const [code, setCode] = useState(initial)
  const navigate = useNavigate()
  useTourEvent('type-example', () => {
    let n = 0
    setCode('')
    const timer = setInterval(() => {
      n += 1
      setCode(EXAMPLE_CODE.slice(0, n))
      if (n >= EXAMPLE_CODE.length) clearInterval(timer)
    }, 130)
    return () => clearInterval(timer)
  })
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
        data-tour="search"
        className={`flex items-center gap-2 rounded-full border bg-paper p-1.5 pl-5 has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-0 ${
          onDark ? 'border-transparent outline-signal' : 'border-field outline-navy-700'
        }`}
      >
        <input
          id="receipt"
          name="receipt"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. EXP-0002"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="min-h-14 w-full min-w-0 bg-transparent code text-lg text-ink uppercase placeholder:text-muted placeholder:normal-case focus:outline-none focus-visible:outline-none"
        />
        <button type="submit" data-tour-click="check" className="btn btn-signal min-h-14 shrink-0 text-lg focus-visible:outline-navy-700!">
          Check
        </button>
      </div>
      <p className={`mt-2.5 text-sm leading-snug ${onDark ? 'text-navy-100' : 'text-muted'}`}>
        Type the number printed on a receipt to see what was recorded and whether it was later corrected.
      </p>
    </form>
  )
}

/** The slip is a fixed width, so a longer total prints smaller. */
const totalSize = (text: string) =>
  text.length > 18 ? 'text-xl' : text.length > 14 ? 'text-[1.6rem] sm:text-3xl' : 'text-[2.5rem] max-[359px]:text-4xl sm:text-5xl'

function BalanceSlip() {
  const s = useBook()
  if (s.isError && !s.data) return <ErrorNotice onRetry={() => s.refetch()} />
  const d = s.data?.summary
  return (
    <div data-tour="balance" className="slip-shadow rounded-3xl">
      <div className="slip px-6 pt-6 pb-8 sm:px-8 sm:pt-8 sm:pb-10">
        <div data-tour-part="balance">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-muted">Recorded club balance</p>
          {d && (
            <span title="Read from the public record when this page opened" className="inline-flex items-center gap-1.5 rounded-full bg-gain-tint px-2.5 py-0.5 text-xs font-semibold text-gain">
              <span aria-hidden className="live-dot" />
              Live
            </span>
          )}
        </div>
        {d ? (
          <p data-testid="balance" className={`mt-1 ${totalSize(formatAed(d.balance))} leading-12! font-bold tracking-tight whitespace-nowrap tabular-nums sm:leading-14!`}>
            {formatAed(d.balance)}
          </p>
        ) : (
          <Skeleton className="mt-1 h-12 w-56 sm:h-14" />
        )}
        </div>
        <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(7.25rem,1fr))] gap-3 border-t border-dashed border-field/60 pt-5">
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

/** Three real receipts, one for each kind of result, so a first visit can see every verdict in one click. */
const EXAMPLES = ['INC-0001', 'EXP-0002', 'EXP-0004']
const CHIP: Record<Verdict, { text: string; dot: string }> = {
  GENUINE: { text: 'Genuine', dot: 'bg-[#3fbf8f]' },
  CORRECTED: { text: 'Corrected', dot: 'bg-[#eec567]' },
  CANCELLED: { text: 'Cancelled', dot: 'bg-navy-200' },
  NOT_FOUND: { text: 'Not found', dot: 'bg-[#e0676a]' },
}

function Example({ code }: { code: string }) {
  const q = useVersions(code)
  const chip = q.data ? CHIP[verdictOf(q.data)] : null
  return (
    <Link
      to={`/check/${code}`}
      className="flex min-h-11 flex-col justify-center rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm max-[359px]:px-2 text-white transition-colors hover:border-white/30 hover:bg-white/10 sm:flex-row sm:items-center sm:justify-start sm:gap-2 sm:rounded-full sm:py-0"
    >
      <span className="code font-semibold whitespace-nowrap max-[359px]:text-[0.75rem] max-[359px]:tracking-normal">{code}</span>
      {chip && (
        <span className="inline-flex items-center gap-1.5 text-xs text-navy-100 sm:text-sm">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${chip.dot}`} />
          {chip.text}
        </span>
      )}
    </Link>
  )
}

function Examples() {
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-navy-100">Or try a real one</p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {EXAMPLES.map((c) => (
          <Example key={c} code={c} />
        ))}
      </div>
      <Link to="/receipts" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-signal underline decoration-signal/40 underline-offset-4 hover:decoration-signal">
        Compare them with their paper receipts
        <span aria-hidden>→</span>
      </Link>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative">
      {/* On phones the green stops behind the slip, so the slip sits across the edge. */}
      <div aria-hidden className="band band-navy absolute inset-x-0 top-0 bottom-28 lg:bottom-0" style={{ position: 'absolute' }} />
      <div className="wrap relative grid grid-cols-[minmax(0,1fr)] gap-9 pt-9 pb-2 lg:grid-cols-[1.35fr_0.85fr] lg:items-center lg:gap-16 lg:py-14">
        <div className="on-dark text-white">
          <h1 className="rise max-w-2xl text-[2.6rem] leading-none font-extrabold tracking-tight sm:text-6xl">
            See the Robotics Club's <span className="text-signal">income and expenses.</span>
          </h1>
          <p className="rise mt-4 mb-6 max-w-lg text-lg leading-snug text-navy-100 [animation-delay:80ms]">
            The club's treasurers record each one on a public blockchain, where it can't be edited or deleted. Anyone can read the records for free, without an account.
          </p>
          <div className="rise [animation-delay:160ms]">
            <ReceiptSearch onDark />
            <Examples />
          </div>
        </div>
        <div className="rise [animation-delay:240ms]">
          <BalanceSlip />
        </div>
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
      <ol data-tour="rules" className="sheet grid overflow-hidden sm:grid-cols-2">
        {PROOFS.map((p) => (
          <li
            key={p.rule}
            data-tour-part={p.rule === 1 ? 'rules' : undefined}
            className="flex flex-col border-line p-5 not-first:border-t sm:p-6 sm:even:border-l sm:[&:nth-child(2)]:border-t-0"
          >
            <span aria-hidden className="font-display text-4xl font-extrabold text-navy-700/55">
              {p.rule}
            </span>
            <h3 className="mt-2 text-xl leading-tight font-bold">{p.title}</h3>
            <p className="mt-2 mb-4 text-muted">{p.description}</p>
            <div data-tour-part={p.rule === 1 ? 'rules' : undefined} className="mt-auto flex flex-wrap gap-2">
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

function LatestEntries() {
  const q = useBook()
  return (
    <section aria-labelledby="recent-h" className="wrap py-14 lg:py-24">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="recent-h" className="text-4xl leading-none font-bold tracking-tight sm:text-5xl">
              Latest entries
            </h2>
            <DemoMark />
          </div>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">
            The five most recent additions in AED, oldest first. A correction shows only the difference it made. Select any line to see that receipt's full history.
          </p>
        </div>
        <Link to="/ledger" className="inline-flex min-h-11 items-center font-semibold text-navy-700 underline underline-offset-4">
          See all entries
        </Link>
      </div>
      {q.isError && !q.data ? (
        <ErrorNotice onRetry={() => q.refetch()} />
      ) : (
        <div data-tour="latest" className="sheet overflow-hidden">
          <LedgerTable lines={q.data?.lines} corrected={q.data?.corrected} show={5} />
        </div>
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
    'Why not just a spreadsheet?',
    'Whoever controls a spreadsheet can quietly edit or delete a row, and nobody else can tell. Here nobody can: every change is a new, visible correction with a reason, and the four rules are checked by the contract itself, not by a person.',
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

/** Short enough for one line on a phone. The copy button always copies the whole address. */
const SHORT_ADDRESS = `${CONTRACT_ADDRESS.slice(0, 10)}…${CONTRACT_ADDRESS.slice(-8)}`

function ContractAddress() {
  const q = useBook()
  const [copied, setCopied] = useState<'yes' | 'no'>()
  const [marked, setMarked] = useState(false)
  useTourEvent('mark-address', () => setMarked(true))
  const latest = q.data?.lines.at(-1)?.entry
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS)
      setCopied('yes')
      setTimeout(() => setCopied(undefined), 2400)
    } catch {
      setCopied('no')
    }
  }
  return (
    <div data-tour="contract" className="mt-10 border-t border-white/15 pt-8">
      <p className="text-navy-200">Contract address</p>
      <div
        data-tour-part="contract"
        className={`mt-3 flex items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-4 ring-1 transition-colors duration-500 sm:pl-5 ${
          marked ? 'bg-signal/20 ring-signal' : 'bg-white/[0.06] ring-white/15'
        }`}
      >
        {/* Scales with the box so the whole address stays on one line. */}
        <div className="min-w-0 flex-1 [container-type:inline-size]">
          <p
            data-testid="contract-address"
            className="text-[1.05rem] leading-tight font-extrabold tracking-[0.02em] whitespace-nowrap text-signal select-all sm:text-[min(2.6rem,calc(100cqi/27.4))]"
          >
            <span aria-hidden className="sm:hidden">
              {SHORT_ADDRESS}
            </span>
            <span className="max-sm:sr-only">{CONTRACT_ADDRESS}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          data-tour-click="copy"
          aria-label="Copy address"
          title="Copy address"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-signal transition-colors hover:bg-white/10 sm:h-12 sm:w-12"
        >
          <Icon name={copied === 'yes' ? 'check' : 'copy'} className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-navy-100">
        <ExtLink href={contractUrl}>Read the contract on BaseScan</ExtLink>
        <ExtLink href={REPO_URL}>Source code</ExtLink>
        <p role="status" className={copied ? 'text-sm text-signal' : 'sr-only'}>
          {copied === 'yes' && 'Address copied.'}
          {copied === 'no' && "Couldn't copy. Open the contract on BaseScan instead."}
        </p>
      </div>
      <p className="mt-2 min-h-10 text-sm leading-5 text-navy-200 sm:min-h-5">
        {q.data && latest && `${q.data.summary.entryCount} entries saved, including corrections. The latest was saved on ${formatDateTime(latest.timestamp)}.`}
      </p>
    </div>
  )
}

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
        <ContractAddress />
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Rules />
      <LatestEntries />
      <HowItWorks />
    </>
  )
}
