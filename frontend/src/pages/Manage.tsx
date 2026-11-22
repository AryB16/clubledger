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
import { Card, ErrorNotice, ExtLink, Person, Skeleton } from '../components/ui'

const CATEGORIES = ['Sponsorship', 'Membership', 'Grant', 'Events', 'Equipment', 'Competition', 'Printing', 'Transport', 'Other']

// ───────────── small form primitives ─────────────

const inputCls = (bad?: boolean) =>
  `min-h-12 w-full min-w-0 rounded-xl border bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
    bad ? 'border-red-500 ring-2 ring-red-500/30 focus:ring-red-500/40' : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600/30'
  }`

function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

function PrimaryButton({ children, busy, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...p}
      disabled={busy || p.disabled}
      className="min-h-12 w-full rounded-xl bg-emerald-700 px-5 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
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
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [state.reason])
  return (
    <div ref={ref} role="alert" data-testid="refusal-card" className="scroll-mt-4 rounded-2xl border-2 border-red-300 bg-red-50 p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-700 text-lg font-bold text-white">
          ✗
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-red-950">Blocked by the club's rulebook</h3>
          <p className="mt-1 text-red-900">{refusalCopy(state.reason)}</p>
          <p className="mt-2 text-sm text-red-900/80">{RULEBOOK_LINE}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {proof && (
          <a
            href={txUrl(proof.refusedTx)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-700 px-4 text-center font-semibold text-white hover:bg-red-800"
          >
            Show the refusal on the public record
          </a>
        )}
        {demo && !forced && (
          <button
            onClick={onSendAnyway}
            className="min-h-12 rounded-xl border border-red-300 bg-white px-4 font-semibold text-red-900 hover:bg-red-100"
          >
            Send it anyway
          </button>
        )}
        {forced?.status === 'sending' && <p className="text-sm font-medium text-red-900">Sending it to the rulebook anyway… confirm in your wallet.</p>}
        {forced?.status === 'done' && forced.hash && (
          <ExtLink href={txUrl(forced.hash)} className="text-red-900">
            Refused on-chain — view it ↗
          </ExtLink>
        )}
        {forced?.status === 'done' && forced.error && <p className="text-sm text-red-900">{forced.error}</p>}
        <button onClick={onClose} className="min-h-11 text-sm font-medium text-red-900/80 underline underline-offset-2">
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
      <p role="alert" className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm font-medium text-slate-800">
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
    <Card className="p-5">
      <h2 className="text-lg font-semibold text-slate-900">Record money</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4" data-testid="record-form">
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
          {(['Income', 'Expense'] as const).map((k, i) => (
            <button
              type="button"
              key={k}
              role="radio"
              aria-checked={kind === i}
              onClick={() => setKind(i as 0 | 1)}
              className={`min-h-11 rounded-xl text-sm font-semibold ${kind === i ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
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
      setLoadMsg("Can't reach the public record right now — try again")
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
    <Card className="p-5">
      <h2 className="text-lg font-semibold text-slate-900">Correct an entry</h2>
      <p className="mt-1 text-sm text-slate-600">
        A correction is added as a new version. The original stays on the record forever. Enter 0 to cancel an entry.
      </p>
      <form onSubmit={load} className="mt-4 flex gap-2">
        <label htmlFor="fix-code" className="sr-only">
          Receipt number
        </label>
        <input id="fix-code" placeholder="Receipt number, e.g. EXP-0002" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls()} font-mono uppercase placeholder:normal-case`} />
        <button type="submit" disabled={loading} className="min-h-12 shrink-0 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">
          {loading ? '…' : 'Load'}
        </button>
      </form>
      {loadMsg && <p className="mt-2 text-sm text-slate-700">{loadMsg}</p>}
      {latest && (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
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
    <Card className="p-5">
      <h2 className="text-lg font-semibold text-slate-900">Authorise or revoke a treasurer</h2>
      <form onSubmit={act} className="mt-4 space-y-4">
        <Field label="Wallet address" htmlFor="adm-addr" error={addr && !valid ? 'That isn’t a valid address.' : undefined}>
          <input id="adm-addr" placeholder="0x…" value={addr} onChange={(e) => setAddr(e.target.value)} spellCheck={false} className={`${inputCls(badField(flow.state, 'address'))} font-mono text-sm`} />
        </Field>
        {target && (
          <p className="text-sm text-slate-700" data-testid="addr-status">
            {role.isPending ? 'Checking…' : role.data?.isPoster ? `Currently an authorised treasurer: ${role.data.label}` : role.data?.label ? `Former treasurer (${role.data.label})` : 'Not a treasurer'}
          </p>
        )}
        {!role.data?.isPoster && (
          <Field label="Label" htmlFor="adm-label" hint="Shown publicly next to their entries, e.g. “Treasurer”. 1–32 characters.">
            <input id="adm-label" maxLength={32} value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls(badField(flow.state, 'label'))} />
          </Field>
        )}
        <PrimaryButton type="submit" busy={busy} disabled={!target}>
          {flow.state.phase === 'checking' ? 'Checking with the rulebook…' : flow.state.phase === 'sending' ? 'Confirm in your wallet…' : role.data?.isPoster ? 'Revoke' : 'Authorise'}
        </PrimaryButton>
        <FlowFeedback state={flow.state} demo={demo} flow={flow} />
      </form>
      <div className="mt-6 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Treasurers on the record</h3>
        <p className="text-xs text-slate-500">Everyone who has recorded an entry. Type any address above to check its status.</p>
        <ul className="mt-2 divide-y divide-slate-100">
          {known.length === 0 && <li className="py-2 text-sm text-slate-500">No entries yet.</li>}
          {known.map((a) => (
            <li key={a} className="flex items-center justify-between py-2">
              <Person label={labelOf(a)} address={a} />
              <span className={`text-xs font-semibold ${roles[a] ? 'text-emerald-700' : 'text-slate-500'}`}>{roles[a] === undefined ? '' : roles[a] ? 'Current' : 'Former'}</span>
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
  const tone = toast.tone === 'ok' ? 'bg-emerald-800' : toast.tone === 'bad' ? 'bg-red-800' : 'bg-slate-900'
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className={`flex w-full max-w-md items-center justify-between gap-3 rounded-2xl ${tone} px-4 py-3 text-sm font-medium text-white shadow-lg`}>
        {toast.href ? (
          <a href={txUrl(toast.href)} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {toast.text}
          </a>
        ) : (
          <span>{toast.text}</span>
        )}
        <button onClick={onClose} aria-label="Close" className="min-h-11 min-w-11 text-lg leading-none">
          ×
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
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">For treasurers</h1>
        <Card className="p-5">
          <p className="text-base text-slate-800">Connect a wallet to add entries (not needed to check).</p>
          <button
            onClick={() => connect({ connector: connectors[0] })}
            disabled={connecting || status === 'reconnecting'}
            className="mt-4 min-h-12 w-full rounded-xl bg-emerald-700 px-5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {connecting ? 'Connecting…' : 'Connect wallet'}
          </button>
          {noWallet && (
            <p className="mt-3 text-sm text-slate-600">
              No browser wallet found. Install MetaMask to add entries — checking receipts doesn't need one.
            </p>
          )}
          {connectError && (connectError.name as string) !== 'ProviderNotFoundError' && <p className="mt-3 text-sm text-slate-700">Couldn't connect. Open your wallet and try again.</p>}
        </Card>
      </div>
    )
  }

  if (wrongChain) {
    return (
      <Card className="p-5">
        <p className="font-semibold text-slate-900">Switch your wallet to the club's network</p>
        <p className="mt-1 text-sm text-slate-600">The club's record lives on the Base Sepolia test network.</p>
        <button onClick={() => switchChain({ chainId: CHAIN.id })} disabled={switching} className="mt-4 min-h-12 w-full rounded-xl bg-emerald-700 font-semibold text-white disabled:opacity-60">
          {switching ? 'Switching…' : 'Switch network'}
        </button>
        {switchError && <p className="mt-2 text-sm text-slate-700">Your wallet didn't switch. Approve the request in your wallet, or add the network manually.</p>}
      </Card>
    )
  }

  if (summary.isError && !summary.data) return <ErrorNotice onRetry={() => summary.refetch()} />
  if (!summary.data || role.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  const isAdmin = address!.toLowerCase() === summary.data.admin.toLowerCase()
  const isPoster = !!role.data?.isPoster

  const banner = isAdmin
    ? { text: "You're the Club Advisor — you approve treasurers but can't add money.", cls: 'bg-slate-900 text-white' }
    : isPoster
      ? { text: `You're the ${role.data!.label} — you can add entries.`, cls: 'bg-emerald-700 text-white' }
      : { text: "You're not a treasurer — anything you submit will be blocked.", cls: 'bg-red-700 text-white' }

  return (
    <div className="space-y-5">
      <div data-testid="role-banner" className={`-mx-4 px-4 py-3 sm:mx-0 sm:rounded-2xl ${banner.cls}`}>
        <p className="font-semibold">{banner.text}</p>
        <div className="mt-1 flex items-center justify-between text-xs opacity-80">
          <span className="font-mono">{shortAddr(address!)}</span>
          <button onClick={() => disconnect()} className="min-h-11 underline underline-offset-2">
            Disconnect
          </button>
        </div>
      </div>
      {demo && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">Demo mode: refused submissions can be sent anyway, so the refusal lands on the public record.</p>}
      {isAdmin ? (
        <AdminPanel demo={demo} onToast={setToast} allEntries={allEntries} />
      ) : (
        <>
          <RecordForm demo={demo} onToast={setToast} allEntries={allEntries} />
          {isPoster && <CorrectForm demo={demo} onToast={setToast} />}
        </>
      )}
      <ToastBar toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
