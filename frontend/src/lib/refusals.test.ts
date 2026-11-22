import { describe, expect, it } from 'vitest'
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  UserRejectedRequestError,
  HttpRequestError,
} from 'viem'
import { CLUBLEDGER_ABI } from '../abi/abi'
import { classifyError, extractRevertReason, proofForReason, REFUSAL_COPY, refusalCopy } from './refusals'

// Every revert string in ClubLedger.sol, byte-for-byte (SPEC §2.5).
const SPEC_REASONS = [
  'Not an authorised poster',
  'Only the admin can manage posters',
  'Expense exceeds club balance',
  'Reference code already used',
  'Entry already corrected - correct the latest version',
  'Correction would make balance negative',
  'Amount must be greater than zero',
  'Invalid reference code',
  'Invalid category',
  'Text too long',
  'Reason required',
  'Admin cannot be a poster',
  'Already a poster',
  'Not a poster',
  'Invalid address',
  'Invalid label',
  'Entry does not exist',
]

const SPEC_COPY: Record<string, string> = {
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
  'Invalid category': 'Check the highlighted field.',
  'Text too long': 'Check the highlighted field.',
  'Reason required': 'Check the highlighted field.',
  'Admin cannot be a poster': "The Club Advisor approves treasurers but can't record money — separation of duties.",
  'Entry does not exist': 'No entry with that number.',
}

const ERROR_STRING_ABI = [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }] as const

/** Build the exact error shape viem's simulateContract throws for a require() revert. */
function simulatedRevert(reason: string) {
  const data = encodeErrorResult({ abi: ERROR_STRING_ABI, errorName: 'Error', args: [reason] })
  const cause = new ContractFunctionRevertedError({ abi: CLUBLEDGER_ABI, data, functionName: 'postEntry' })
  return new ContractFunctionExecutionError(cause, {
    abi: CLUBLEDGER_ABI,
    functionName: 'postEntry',
    args: [0, 1n, 'Cat', '', '', 'INC-0001'],
    contractAddress: '0x0000000000000000000000000000000000000001',
  })
}

describe('extractRevertReason', () => {
  it.each(SPEC_REASONS)('walks the viem error to %j', (reason) => {
    expect(extractRevertReason(simulatedRevert(reason))).toBe(reason)
  })

  it.each(SPEC_REASONS)('finds %j in flattened RPC text', (reason) => {
    expect(extractRevertReason(new Error(`execution reverted: ${reason}`))).toBe(reason)
  })

  it('does not confuse "Not a poster" with "Not an authorised poster"', () => {
    expect(extractRevertReason(new Error('reverted: Not an authorised poster'))).toBe('Not an authorised poster')
    expect(extractRevertReason(new Error('reverted: Not a poster'))).toBe('Not a poster')
  })

  it('returns null for non-revert errors', () => {
    expect(extractRevertReason(new Error('boom'))).toBeNull()
    expect(extractRevertReason(undefined)).toBeNull()
  })
})

describe('refusal copy', () => {
  it('has copy for every revert string in the contract', () => {
    for (const r of SPEC_REASONS) expect(REFUSAL_COPY[r], r).toBeTruthy()
  })
  it.each(Object.entries(SPEC_COPY))('%j maps to the SPEC copy', (reason, copy) => {
    expect(refusalCopy(reason)).toBe(copy)
  })
  it('never uses jargon in copy', () => {
    for (const c of Object.values(REFUSAL_COPY)) expect(c).not.toMatch(/revert|simulate|tx hash|chain id|poster/i)
  })
})

describe('proofForReason', () => {
  it.each([
    ['Not an authorised poster', 1],
    ['Expense exceeds club balance', 2],
    ['Correction would make balance negative', 2],
    ['Reference code already used', 3],
    ['Entry already corrected - correct the latest version', 4],
  ])('%j → rule %i', (reason, rule) => {
    expect(proofForReason(reason)?.rule).toBe(rule)
  })
  it('has no proof for plain field validation', () => {
    expect(proofForReason('Text too long')).toBeUndefined()
  })
})

describe('classifyError', () => {
  it('classifies reverts', () => {
    const c = classifyError(simulatedRevert('Not an authorised poster'))
    expect(c.kind).toBe('refused')
    expect(c.reason).toBe('Not an authorised poster')
  })
  it('classifies wallet rejections', () => {
    expect(classifyError(new UserRejectedRequestError(new Error('User rejected the request.'))).kind).toBe('rejected')
  })
  it('classifies RPC outages with the plain message', () => {
    const c = classifyError(new HttpRequestError({ url: 'https://x', details: 'Failed to fetch' }))
    expect(c.kind).toBe('network')
    expect(c.message).toBe("Can't reach the public record right now — try again")
  })
  it('never exposes raw error text', () => {
    const c = classifyError(new Error('TypeError: cannot read properties of undefined at 0x1234'))
    expect(c.message).not.toContain('TypeError')
  })
})
