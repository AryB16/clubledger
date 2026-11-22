// Pure module: pull the contract's revert reason out of a viem error and map it to plain-English copy (SPEC §2.5).
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem'
import { PROOFS, type RuleProof } from '../proofs.ts'

export const RULEBOOK_LINE =
  'The rulebook is a smart contract on a public blockchain, not this website. Nobody can switch it off.'

const FIELD = 'Check the highlighted field.'

/** Every revert string in ClubLedger.sol → the UI copy from SPEC §2.5. */
export const REFUSAL_COPY: Record<string, string> = {
  'Not an authorised poster': "This wallet isn't an authorised treasurer, so the club's rulebook refused it.",
  'Only the admin can manage posters': 'Only the Club Advisor can add or remove treasurers.',
  'Expense exceeds club balance':
    "The club's books don't have enough money recorded for this expense. The books can never go negative.",
  'Reference code already used': 'This receipt number has already been recorded. A receipt can only be recorded once.',
  'Entry already corrected - correct the latest version':
    'This version has already been corrected. Correct the newest version instead.',
  'Correction would make balance negative': "This correction would push the club's books below zero.",
  'Amount must be greater than zero': 'Enter an amount above zero.',
  'Invalid reference code':
    'Receipt numbers use capital letters, digits and dashes only (e.g. EXP-0007), up to 16 characters.',
  'Invalid category': FIELD,
  'Text too long': FIELD,
  'Reason required': FIELD,
  'Admin cannot be a poster': "The Club Advisor approves treasurers but can't record money. Those jobs are kept separate.",
  'Already a poster': 'This address is already an authorised treasurer.',
  'Not a poster': 'This address is not a current treasurer.',
  'Invalid address': 'Enter a valid address.',
  'Invalid label': 'Give the treasurer a label of 1 to 32 characters.',
  'Entry does not exist': 'No entry with that number.',
}

export const KNOWN_REASONS = Object.keys(REFUSAL_COPY)

/** Which form field a validation revert points at. */
export const REASON_FIELD: Record<string, string> = {
  'Invalid category': 'category',
  'Reason required': 'reason',
  'Amount must be greater than zero': 'amount',
  'Invalid reference code': 'refCode',
  'Reference code already used': 'refCode',
  'Invalid address': 'address',
  'Invalid label': 'label',
}

/**
 * Walk a viem error to the contract's revert reason string.
 * Falls back to scanning the error text for a known reason (some RPCs flatten the revert data).
 */
export function extractRevertReason(err: unknown): string | null {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      const r = reverted.reason ?? (reverted.data?.args?.[0] as string | undefined)
      if (r) return r
    }
  }
  const text = collectText(err)
  // Longest first so "Not a poster" never shadows "Not an authorised poster".
  for (const r of [...KNOWN_REASONS].sort((a, b) => b.length - a.length)) {
    if (text.includes(r)) return r
  }
  return null
}

function collectText(err: unknown): string {
  const parts: string[] = []
  let cur: unknown = err
  for (let i = 0; cur && i < 10; i++) {
    if (typeof cur === 'string') {
      parts.push(cur)
      break
    }
    const o = cur as { message?: unknown; details?: unknown; shortMessage?: unknown; cause?: unknown }
    for (const k of [o.message, o.details, o.shortMessage]) if (typeof k === 'string') parts.push(k)
    cur = o.cause
  }
  return parts.join('\n')
}

/** Plain-English copy for a revert reason (or a generic line for unknown reasons). */
export function refusalCopy(reason: string): string {
  return REFUSAL_COPY[reason] ?? 'The club’s rulebook refused this.'
}

/** The on-chain ✗ proof matching this refusal, if one of the 4 headline rules covers it. */
export function proofForReason(reason: string): RuleProof | undefined {
  const rule =
    reason === 'Correction would make balance negative'
      ? 2
      : reason === 'Only the admin can manage posters' || reason === 'Admin cannot be a poster'
        ? 1
        : PROOFS.find((p) => p.refusalReason === reason)?.rule
  return PROOFS.find((p) => p.rule === rule)
}

export type FailureKind = 'refused' | 'rejected' | 'network' | 'unknown'

/** Classify any write-flow error so the UI never shows a raw stack. */
export function classifyError(err: unknown): { kind: FailureKind; reason: string | null; message: string } {
  const reason = extractRevertReason(err)
  if (reason) return { kind: 'refused', reason, message: refusalCopy(reason) }
  if (err instanceof BaseError && err.walk((e) => e instanceof UserRejectedRequestError)) {
    return { kind: 'rejected', reason: null, message: 'You cancelled the request in your wallet. Nothing was sent.' }
  }
  const text = collectText(err).toLowerCase()
  if (text.includes('user rejected') || text.includes('user denied')) {
    return { kind: 'rejected', reason: null, message: 'You cancelled the request in your wallet. Nothing was sent.' }
  }
  if (/fetch|network|timeout|timed out|http request failed|failed to fetch/.test(text)) {
    return { kind: 'network', reason: null, message: "Can't reach the public record right now. Try again." }
  }
  if (text.includes('insufficient funds')) {
    return {
      kind: 'unknown',
      reason: null,
      message: 'This wallet has no test funds to pay the network fee. Top it up and try again.',
    }
  }
  return { kind: 'unknown', reason: null, message: 'Something went wrong. Nothing was recorded. Try again.' }
}
