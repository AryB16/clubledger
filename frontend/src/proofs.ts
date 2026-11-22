// On-chain proof transactions for the 4 headline rules (SPEC §2.9). The ONLY hard-coded chain data in the site.
export type Hash = `0x${string}`

export interface RuleProof {
  rule: 1 | 2 | 3 | 4
  title: string
  description: string
  /** The contract's revert string this rule produces — links the refusal card to the right proof. */
  refusalReason: string
  passedTx: Hash
  refusedTx: Hash
}

const PENDING = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hash

export const PROOFS: RuleProof[] = [
  {
    rule: 1,
    title: 'Only authorised treasurers can record money',
    description: 'Anyone else is refused — even the Club Advisor.',
    refusalReason: 'Not an authorised poster',
    passedTx: PENDING,
    refusedTx: PENDING,
  },
  {
    rule: 2,
    title: 'The books can never go negative',
    description: 'An expense larger than the recorded balance is refused.',
    refusalReason: 'Expense exceeds club balance',
    passedTx: PENDING,
    refusedTx: PENDING,
  },
  {
    rule: 3,
    title: 'A receipt can only be recorded once',
    description: 'Duplicate receipt numbers are refused.',
    refusalReason: 'Reference code already used',
    passedTx: PENDING,
    refusedTx: PENDING,
  },
  {
    rule: 4,
    title: 'No edits — only corrections',
    description: 'A correction is a new entry. The original stays forever and can’t be corrected twice.',
    refusalReason: 'Entry already corrected - correct the latest version',
    passedTx: PENDING,
    refusedTx: PENDING,
  },
]
