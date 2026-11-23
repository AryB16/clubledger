import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PAPER_RECEIPTS, type PaperReceipt } from '../receipts'
import { useVersions, verdictOf, type Verdict } from '../lib/ledger'
import { formatAed } from '../lib/money'
import { DemoMark, PageHead, Skeleton } from '../components/ui'

const RESULT: Record<Verdict, { text: string; tone: string }> = {
  GENUINE: { text: 'Genuine record', tone: 'bg-gain-tint text-gain' },
  CORRECTED: { text: 'Corrected', tone: 'bg-amber-100 text-amber-900' },
  CANCELLED: { text: 'Cancelled', tone: 'bg-mist text-ink' },
  NOT_FOUND: { text: 'No such record', tone: 'bg-brick-tint text-brick' },
}

/** The paper, as the vendor printed it. */
function Paper({ r }: { r: PaperReceipt }) {
  return (
    <div className="paper px-5 pt-6 pb-7">
      <p className="text-center text-base font-bold tracking-wide uppercase">{r.vendor}</p>
      <p className="text-center text-sm text-muted">{r.address}</p>
      <div className="my-3 border-t border-line" />
      <p className="flex justify-between gap-3">
        <span>Receipt no.</span>
        <b>{r.code}</b>
      </p>
      <p className="flex justify-between gap-3">
        <span>Date</span>
        <span>{r.date}</span>
      </p>
      <div className="my-3 border-t border-line" />
      {r.lines.map(([what, amount]) => (
        <p key={what} className="flex justify-between gap-3">
          <span>{what}</span>
          <span>{amount}</span>
        </p>
      ))}
      <div className="my-3 border-t border-line" />
      <p className="flex justify-between gap-3 text-base font-bold">
        <span>TOTAL (AED)</span>
        <span>{r.total}</span>
      </p>
      <p className="mt-1 text-center text-xs text-muted">{r.note}</p>
      <div className="my-4 border-t border-dashed border-field/60" />
      <img src={`/qr/${r.code}.png`} alt={`QR code that opens receipt ${r.code} on this site`} width="160" height="160" className="mx-auto h-40 w-40 [image-rendering:pixelated]" />
      <p className="mt-2 text-center text-sm font-bold">Scan to check this receipt on the club's public record</p>
    </div>
  )
}

/** What the contract says about the same receipt number, read live. */
function Record({ code, printed }: { code: string; printed: string }) {
  const q = useVersions(code)
  const versions = q.data
  const verdict = versions ? verdictOf(versions) : null
  const latest = versions?.at(-1)
  return (
    <div className="print:hidden rounded-2xl border border-line bg-paper p-4">
      <p className="text-sm font-semibold text-muted">On the public record now</p>
      {verdict ? (
        <>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${RESULT[verdict].tone}`}>{RESULT[verdict].text}</span>
            {latest && <span className="text-lg font-bold whitespace-nowrap tabular-nums">{formatAed(latest.amount)}</span>}
          </p>
          {latest && latest.correctsId !== 0n && (
            <p className="mt-2 text-sm leading-snug text-muted">
              The paper says AED {printed}. The treasurer's correction gives the reason: “{latest.reason}”
            </p>
          )}
        </>
      ) : q.isError ? (
        <p className="mt-2 text-sm text-brick">Can't reach the public record right now.</p>
      ) : (
        <Skeleton className="mt-2 h-7 w-44" />
      )}
      <Link to={`/check/${code}`} className="btn btn-dark mt-4 w-full">
        See the full record of {code}
      </Link>
    </div>
  )
}

export default function Receipts() {
  useEffect(() => {
    document.title = 'Sample receipts | ClubLedger'
    return () => {
      document.title = 'ClubLedger | Robotics Club income and expenses'
    }
  }, [])
  return (
    <>
      <PageHead title="Sample receipts" mark={<DemoMark onDark />}>
        <p className="mt-4 max-w-2xl leading-relaxed text-navy-100 sm:text-lg">
          The paper receipts behind three entries. The paper stays with the club; what a treasurer recorded about it is on the public record. Scan a code with your phone, or compare each paper with its record below.
        </p>
        <button type="button" onClick={() => window.print()} className="btn btn-signal mt-6 print:hidden">
          Print these receipts
        </button>
      </PageHead>
      <div className="wrap grid items-start gap-8 py-8 sm:py-12 md:grid-cols-2 lg:grid-cols-3">
        {PAPER_RECEIPTS.map((r) => (
          <article key={r.code} data-testid="paper-receipt" aria-label={`Receipt ${r.code}`} className="grid gap-4 break-inside-avoid">
            <Paper r={r} />
            <Record code={r.code} printed={r.total} />
          </article>
        ))}
      </div>
    </>
  )
}
