import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConnect, useConnection, useDisconnect, useSwitchChain } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { CHAIN, txUrl } from '../config'
import { readVersions, useAllEntries, useLabels, useRole, useSummary, type Entry } from '../lib/ledger'
import { filsToInput, formatAed, parseAedToFils } from '../lib/money'
import { normaliseCode, shortAddr } from '../lib/format'
import { proofForReason, REASON_FIELD, refusalCopy, RULEBOOK_LINE } from '../lib/refusals'
import { useWriteFlow, type Toast, type WriteState } from '../lib/write'
import { Icon } from '../components/icons'
import { PROOFS } from '../proofs'
import { Card, ErrorNotice, ExtLink, PageHead, Person, RPC_DOWN, Skeleton } from '../components/ui'

const CATEGORIES = ['Sponsorship', 'Membership', 'Grant', 'Events', 'Equipment', 'Competition', 'Printing', 'Transport', 'Other']

// ───────────── small form primitives ─────────────

const inputCls = (bad?: boolean) =>
  `min-h-12 w-full min-w-0 rounded-xl border bg-white px-3.5 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-3 ${
    bad ? 'border-brick ring-2 ring-brick/30 focus:ring-brick/50' : 'border-field focus:border-forest-700 focus:ring-forest-700/45'
  }`

function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-sm text-brick">{error}</p> : hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

function PrimaryButton({ children, busy, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...p}
      disabled={busy || p.disabled}
      className="btn btn-dark min-h-14 w-full text-lg"
    >
      {children}
    </button>
  )
}

// ───────────── refusal card (SPEC §3.4) ─────────────

function RefusalCard({ state, demo, onSendAnyway, onClose }: { state: Extract<WriteState, { phase: 'refused' }>; demo: boolean; onSendAnyway: () => void; onClose: () => void }) {
  const proof = proofForReason(state.reason)
  const forced = state.forced
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' })
  }, [state.reason])
  return (
    <div ref={ref} role="alert" data-testid="refusal-card" className="band band-corner band-refused on-dark scroll-mt-4 rounded-3xl p-5 sm:p-7">
      <span aria-hidden className="grid h-14 w-14 -rotate-6 place-items-center rounded-full border-[3px] border-current">
        <Icon name="cross" className="h-7 w-7" />
      </span>
      <h3 className="mt-4 text-[2rem] leading-none font-extrabold tracking-tight sm:text-4xl">Blocked by the club's rulebook</h3>
      <p className="mt-4 text-lg leading-snug">{refusalCopy(state.reason)}</p>
      <p className="mt-3 text-sm leading-relaxed text-[#f8d9d0]">{RULEBOOK_LINE}</p>
      <div className="mt-6 flex flex-col gap-2.5">
        {proof && (
          <a href={txUrl(proof.refusedTx)} target="_blank" rel="noreferrer" className="btn bg-white text-brick hover:bg-[#fbeae4]">
            Show the refusal on the public record
          </a>
        )}
        {demo && !forced && (
          <button type="button" onClick={onSendAnyway} className="btn border border-white/60 text-white hover:bg-white/10">
            Send it anyway
          </button>
        )}
        {forced?.status === 'sending' && <p className="text-sm font-medium">Sending it to the rulebook anyway. Confirm in your wallet.</p>}
        {forced?.status === 'done' && forced.hash && (
          <ExtLink href={txUrl(forced.hash)} className="justify-center text-lg">
            View this refusal on the blockchain
          </ExtLink>
        )}
        {forced?.status === 'done' && forced.error && <p className="text-sm">{forced.error}</p>}
        <button type="button" onClick={onClose} className="min-h-11 text-sm font-medium underline underline-offset-4">
          Dismiss
        </button>
      </div>
    </div>
  )
}

function FlowFeedback({ state, demo, flow }: { state: WriteState; demo: boolean; flow: ReturnType<typeof useWriteFlow> }) {
  if (state.phase === 'refused') return <RefusalCard state={state} demo={demo} onSendAnyway={flow.sendAnyway} onClose={flow.reset} />
  if (state.phase === 'error')
    return (
      <p role="alert" className="rounded-xl border border-field bg-sand p-3 text-sm font-medium text-ink">
        {state.message}
      </p>
    )
  return null
}

const badField = (state: WriteState, name: string) => state.phase === 'refused' && REASON_FIELD[state.reason] === name

// ───────────── Record money ─────────────

function nextFree(entries: Entry[], prefix: 'INC' | 'EXP') {
  let max = 0
  const re = new RegExp(`^${prefix}-(\\d+)$`)
  for (const e of entries) {
    const m = re.exec(e.refCode)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}

function RecordForm({ demo, onToast, allEntries }: { demo: boolean; onToast: (t: Toast | null) => void; allEntries: Entry[] }) {
  const flow = useWriteFlow(onToast)
  const [kind, setKind] = useState<0 | 1>(1)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Equipment')
  const [counterparty, setCounterparty] = useState('')
  const [description, setDescription] = useState('')
  const [ref, setRef] = useState('')
  const [refTouched, setRefTouched] = useState(false)
  const [amountErr, setAmountErr] = useState<string>()

  const suggested = useMemo(() => nextFree(allEntries, kind === 0 ? 'INC' : 'EXP'), [allEntries, kind])
  useEffect(() => {
    if (!refTouched) setRef(suggested)
  }, [suggested, refTouched])

  const busy = flow.state.phase === 'checking' || flow.state.phase === 'sending'

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    const fils = parseAedToFils(amount)
    if (fils === null) {
      setAmountErr('Enter an amount like 250 or 1,250.50')
      return
    }
    setAmountErr(undefined)
    const ok = await flow.submit({
      functionName: 'postEntry',
      args: [kind, fils, category, counterparty.trim(), description.trim(), normaliseCode(ref)],
    })
    if (ok) {
      setAmount('')
      setCounterparty('')
      setDescription('')
      setRefTouched(false)
    }
  }

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-2xl font-bold">Record money</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4" data-testid="record-form">
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-full bg-sand p-1">
          {(['Income', 'Expense'] as const).map((k, i) => (
            <button
              type="button"
              key={k}
              role="radio"
              aria-checked={kind === i}
              onClick={() => setKind(i as 0 | 1)}
              className={`min-h-11 rounded-full text-sm font-semibold transition-colors ${kind === i ? 'bg-forest-900 text-white' : 'text-ink'}`}
            >
              {k === 'Income' ? 'Money in' : 'Money out'}
            </button>
          ))}
        </div>
        <Field label="Amount (AED)" htmlFor="amount" error={amountErr} hint={badField(flow.state, 'amount') ? 'Enter an amount above zero.' : undefined}>
          <input id="amount" inputMode="decimal" placeholder="250.00" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls(!!amountErr || badField(flow.state, 'amount'))} tabular-nums`} />
        </Field>
        <Field label="Category" htmlFor="category">
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls(badField(flow.state, 'category'))}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label={kind === 0 ? 'Received from' : 'Paid to'} htmlFor="counterparty" hint="Up to 64 characters">
          <input id="counterparty" maxLength={64} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Description" htmlFor="description" hint="Up to 280 characters">
          <textarea id="description" maxLength={280} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls()} py-2`} />
        </Field>
        <Field label="Receipt number" htmlFor="ref" hint="Capital letters, digits and dashes. Pre-filled with the next free number.">
          <input
            id="ref"
            value={ref}
            onChange={(e) => {
              setRef(e.target.value.toUpperCase())
              setRefTouched(true)
            }}
            autoCapitalize="characters"
            spellCheck={false}
            className={`${inputCls(badField(flow.state, 'refCode'))} font-mono uppercase`}
          />
        </Field>
        <PrimaryButton type="submit" busy={busy}>
          {flow.state.phase === 'checking' ? 'Checking with the rulebook…' : flow.state.phase === 'sending' ? 'Confirm in your wallet…' : 'Record it'}
        </PrimaryButton>
        <FlowFeedback state={flow.state} demo={demo} flow={flow} />
      </form>
    </Card>
  )
}

// ───────────── Correct an entry ─────────────

function CorrectForm({ demo, onToast }: { demo: boolean; onToast: (t: Toast | null) => void }) {
  const flow = useWriteFlow(onToast)
  const [code, setCode] = useState('')
  const [latest, setLatest] = useState<Entry | null>(null)
  const [loadMsg, setLoadMsg] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState('')
  const [amountErr, setAmountErr] = useState<string>()

  async function load(ev?: FormEvent) {
    ev?.preventDefault()
    const c = normaliseCode(code)
    if (!c) return
    setLoading(true)
    setLoadMsg(undefined)
    flow.reset()
    try {
      const versions = await readVersions(c)
      if (versions.length === 0) {
        setLatest(null)
        setLoadMsg('No entry with that receipt number.')
      } else {
        const l = versions[versions.length - 1]
        setLatest(l)
        setAmount(filsToInput(l.amount))
        setCategory(l.category)
        setCounterparty(l.counterparty)
        setDescription(l.description)
        setReason('')
      }
    } catch {
      setLoadMsg(RPC_DOWN)
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!latest) return
    const fils = parseAedToFils(amount)
    if (fils === null) {
      setAmountErr('Enter an amount like 380 or 0 to cancel')
      return
    }
    setAmountErr(undefined)
    const ok = await flow.submit({
      functionName: 'correctEntry',
      args: [latest.id, fils, category, counterparty.trim(), description.trim(), reason.trim()],
    })
    if (ok) {
      setLatest(null)
      setCode('')
    }
  }

  const busy = flow.state.phase === 'checking' || flow.state.phase === 'sending'
  const cats = category && !CATEGORIES.includes(category) ? [category, ...CATEGORIES] : CATEGORIES

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-2xl font-bold">Correct an entry</h2>
      <p className="mt-1 text-sm text-muted">
        Your fix is saved as a new version, and the original stays on the record. Enter 0 to cancel an entry.
      </p>
      <form onSubmit={load} className="mt-4 flex gap-2">
        <label htmlFor="fix-code" className="sr-only">
          Receipt number
        </label>
        <input id="fix-code" placeholder="e.g. EXP-0002" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls()} font-mono uppercase placeholder:normal-case`} />
        <button type="submit" disabled={loading} className="btn btn-quiet shrink-0">
          {loading ? '…' : 'Load'}
        </button>
      </form>
      {loadMsg && <p className="mt-2 text-sm text-ink">{loadMsg}</p>}
      {latest && (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <p className="rounded-xl bg-sand p-3 text-sm text-ink">
            Correcting the latest version of <span className="font-mono font-semibold">{latest.refCode}</span> ({latest.kind === 0 ? 'Income' : 'Expense'},{' '}
            {formatAed(latest.amount)}).
          </p>
          <Field label="New amount (AED)" htmlFor="fix-amount" error={amountErr}>
            <input id="fix-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls(!!amountErr)} tabular-nums`} />
          </Field>
          <Field label="Category" htmlFor="fix-category">
            <select id="fix-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls(badField(flow.state, 'category'))}>
              {cats.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label={latest.kind === 0 ? 'Received from' : 'Paid to'} htmlFor="fix-cp">
            <input id="fix-cp" maxLength={64} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className={inputCls()} />
          </Field>
          <Field label="Description" htmlFor="fix-desc">
            <textarea id="fix-desc" maxLength={280} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls()} py-2`} />
          </Field>
          <Field label="Reason for the correction (required)" htmlFor="fix-reason" hint="Up to 140 characters. Shown publicly next to this version.">
            <input id="fix-reason" maxLength={140} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls(badField(flow.state, 'reason'))} />
          </Field>
          <PrimaryButton type="submit" busy={busy}>
            {flow.state.phase === 'checking' ? 'Checking with the rulebook…' : flow.state.phase === 'sending' ? 'Confirm in your wallet…' : 'Add correction'}
          </PrimaryButton>
          <FlowFeedback state={flow.state} demo={demo} flow={flow} />
        </form>
      )}
    </Card>
  )
}

// ───────────── Admin: authorise / revoke ─────────────

function AdminPanel({ demo, onToast, allEntries }: { demo: boolean; onToast: (t: Toast | null) => void; allEntries: Entry[] }) {
  const flow = useWriteFlow(onToast)
  const [addr, setAddr] = useState('')
  const [label, setLabel] = useState('')
  const valid = isAddress(addr.trim())
  const target = valid ? (addr.trim() as Address) : undefined
  const role = useRole(target)
  const known = useMemo(() => [...new Set(allEntries.map((e) => e.poster.toLowerCase()))] as Address[], [allEntries])
  const labelOf = useLabels(target ? [...known, target] : known)
  const roles = useKnownRoles(known)
  const busy = flow.state.phase === 'checking' || flow.state.phase === 'sending'

  async function act(ev: FormEvent) {
    ev.preventDefault()
    if (!target) return
    if (role.data?.isPoster) await flow.submit({ functionName: 'revokePoster', args: [target] })
    else if (await flow.submit({ functionName: 'authorizePoster', args: [target, label.trim()] })) setLabel('')
  }

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-2xl font-bold">Authorise or revoke a treasurer</h2>
      <form onSubmit={act} className="mt-4 space-y-4">
        <Field label="Wallet address" htmlFor="adm-addr" error={addr && !valid ? 'That isn’t a valid address.' : undefined}>
          <input id="adm-addr" placeholder="0x…" value={addr} onChange={(e) => setAddr(e.target.value)} spellCheck={false} className={`${inputCls(badField(flow.state, 'address'))} font-mono text-sm`} />
        </Field>
        {target && (
          <p className="text-sm text-ink" data-testid="addr-status">
            {role.isPending ? 'Checking…' : role.data?.isPoster ? `Currently an authorised treasurer: ${role.data.label}` : role.data?.label ? `Former treasurer (${role.data.label})` : 'Not a treasurer'}
          </p>
        )}
        {!role.data?.isPoster && (
          <Field label="Label" htmlFor="adm-label" hint="Shown publicly next to their entries, e.g. “Treasurer”. 1 to 32 characters.">
            <input id="adm-label" maxLength={32} value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls(badField(flow.state, 'label'))} />
          </Field>
        )}
        <PrimaryButton type="submit" busy={busy} disabled={!target}>
          {flow.state.phase === 'checking' ? 'Checking with the rulebook…' : flow.state.phase === 'sending' ? 'Confirm in your wallet…' : role.data?.isPoster ? 'Revoke' : 'Authorise'}
        </PrimaryButton>
        <FlowFeedback state={flow.state} demo={demo} flow={flow} />
      </form>
      <div className="mt-6 border-t border-line pt-4">
        <h3 className="text-lg font-bold">Treasurers on the record</h3>
        <p className="text-xs text-muted">Everyone who has recorded an entry. Enter any address above to check its status.</p>
        <ul className="mt-2 divide-y divide-line">
          {known.length === 0 && <li className="py-2 text-sm text-muted">No entries yet.</li>}
          {known.map((a) => (
            <li key={a} className="flex items-center justify-between py-2">
              <Person label={labelOf(a)} address={a} />
              <span className={`text-xs font-semibold ${roles[a] ? 'text-forest-700' : 'text-muted'}`}>{roles[a] === undefined ? '' : roles[a] ? 'Current' : 'Former'}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function useKnownRoles(addrs: Address[]) {
  const labels = useLabels(addrs)
  const out: Record<string, boolean | undefined> = {}
  for (const a of addrs) {
    const l = labels(a)
    out[a] = l === '…' ? undefined : !l.endsWith('(former)')
  }
  return out
}

// ───────────── page ─────────────

function ToastBar({ toast, onClose }: { toast: Toast | null; onClose: () => void }) {
  if (!toast) return null
  const tone = toast.tone === 'ok' ? 'bg-forest-900' : toast.tone === 'bad' ? 'bg-brick' : 'bg-ink'
  return (
    <div role="status" aria-live="polite" className="on-dark fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className={`flex w-full max-w-md items-center justify-between gap-3 rounded-2xl ${tone} py-2 pr-2 pl-5 font-medium text-white shadow-lg`}>
        {toast.href ? (
          <a href={txUrl(toast.href)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">
            {toast.text}
            <Icon name="out" />
          </a>
        ) : (
          <span>{toast.text}</span>
        )}
        <button onClick={onClose} aria-label="Close" className="grid min-h-11 min-w-11 place-items-center">
          <Icon name="cross" />
        </button>
      </div>
    </div>
  )
}

export default function Manage() {
  const [params] = useSearchParams()
  const demo = params.get('demo') === '1'
  const { address, isConnected, chainId, status } = useConnection()
  const { connect, connectors, isPending: connecting, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain()
  const summary = useSummary()
  const role = useRole(address)
  const entries = useAllEntries()
  const allEntries = entries.data?.pages.flat() ?? []
  const [toast, setToast] = useState<Toast | null>(null)

  const wrongChain = isConnected && chainId !== CHAIN.id
  useEffect(() => {
    if (wrongChain) switchChain({ chainId: CHAIN.id })
  }, [wrongChain, switchChain])

  useEffect(() => {
    if (toast?.tone === 'ok') {
      const t = setTimeout(() => setToast(null), 12000)
      return () => clearTimeout(t)
    }
  }, [toast])

  if (!isConnected) {
    const noWallet = (connectError?.name as string) === 'ProviderNotFoundError' || (typeof window !== 'undefined' && !(window as { ethereum?: unknown }).ethereum)
    return (
      <>
        <PageHead title="For treasurers">
          <p className="mt-4 max-w-xl leading-relaxed text-forest-100 sm:text-lg">Record income and spending, or fix a mistake with a correction.</p>
        </PageHead>
        <div className="wrap grid items-start gap-9 py-8 md:grid-cols-2 md:gap-16 sm:py-14">
          <Card className="p-5 sm:p-8">
            <h2 className="text-2xl font-bold">Connect a wallet to add entries.</h2>
            <p className="mt-2 text-muted">You don't need one to check receipts.</p>
            <button
              onClick={() => connect({ connector: connectors[0] })}
              disabled={connecting || status === 'reconnecting'}
              className="btn btn-dark mt-6 min-h-14 w-full text-lg"
            >
              {connecting ? 'Connecting…' : 'Connect wallet'}
            </button>
            {noWallet && <p className="mt-4 text-sm text-muted">No browser wallet found. Install MetaMask if you need to add entries.</p>}
            {connectError && (connectError.name as string) !== 'ProviderNotFoundError' && <p className="mt-4 text-sm text-brick">Couldn't connect. Open your wallet and try again.</p>}
          </Card>
          <section>
            <h2 className="text-2xl font-bold">Checked before anything is saved</h2>
            <ul className="mt-3 divide-y divide-line">
              {PROOFS.map((p) => (
                <li key={p.rule} className="flex items-start gap-3 py-3">
                  <Icon name="check" className="mt-1 h-4 w-4 text-forest-700" />
                  {p.title}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </>
    )
  }

  if (wrongChain) {
    return (
      <>
        <PageHead title="For treasurers" />
        <div className="wrap max-w-2xl py-8 sm:py-14">
          <Card className="p-5 sm:p-8">
            <h2 className="text-2xl font-bold">Switch your wallet to the club's network</h2>
            <p className="mt-2 text-muted">The club's record lives on the Base Sepolia test network.</p>
            <button onClick={() => switchChain({ chainId: CHAIN.id })} disabled={switching} className="btn btn-dark mt-6 w-full">
              {switching ? 'Switching…' : 'Switch network'}
            </button>
            {switchError && <p className="mt-3 text-sm text-brick">Your wallet didn't switch. Approve the request in your wallet, or add the network manually.</p>}
          </Card>
        </div>
      </>
    )
  }

  if ((summary.isError && !summary.data) || (role.isError && !role.data)) {
    // An unanswered role lookup must never be presented as "not a treasurer".
    const retry = () => (summary.isError && !summary.data ? summary.refetch() : role.refetch())
    return (
      <div className="wrap py-10">
        <ErrorNotice onRetry={retry} />
      </div>
    )
  }
  if (!summary.data || role.isPending) {
    return (
      <div className="wrap space-y-4 py-8">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    )
  }

  const isAdmin = address!.toLowerCase() === summary.data.admin.toLowerCase()
  const isPoster = !!role.data?.isPoster

  const banner = isAdmin
    ? { text: "You're the Club Advisor. You approve treasurers but can't add money.", band: 'band-cancelled' }
    : isPoster
      ? { text: `You're the ${role.data!.label}. You can add and correct entries.`, band: 'band-forest' }
      : { text: "You aren't a treasurer, so you can't add entries.", band: 'band-refused' }

  return (
    <>
      <div data-testid="role-banner" className={`band on-dark ${banner.band}`}>
        <div className="wrap pt-7 pb-5 sm:pt-10 sm:pb-7">
          <p className="max-w-3xl font-display text-[1.75rem] leading-[1.08] font-bold text-balance sm:text-4xl">{banner.text}</p>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-mono">{shortAddr(address!)}</span>
            <button onClick={() => disconnect()} className="min-h-11 underline underline-offset-4">
              Disconnect
            </button>
          </div>
        </div>
      </div>
      <div className="wrap py-6 sm:py-10">
        <div className={isPoster ? '' : 'mx-auto max-w-2xl'}>
          {demo && <p className="mb-5 rounded-2xl bg-amber-100 p-4 text-sm text-amber-950">Demo mode is on. You can send a refused entry anyway to put the refusal on the public record.</p>}
          {isAdmin ? (
            <AdminPanel demo={demo} onToast={setToast} allEntries={allEntries} />
          ) : (
            <div className={isPoster ? 'grid items-start gap-5 lg:grid-cols-2' : ''}>
              <RecordForm demo={demo} onToast={setToast} allEntries={allEntries} />
              {isPoster && <CorrectForm demo={demo} onToast={setToast} />}
            </div>
          )}
        </div>
      </div>
      <ToastBar toast={toast} onClose={() => setToast(null)} />
    </>
  )
}
