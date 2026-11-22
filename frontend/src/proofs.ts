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


export const PROOFS: RuleProof[] = [
  {
    rule: 1,
    title: 'Only authorised treasurers can record money',
    description: 'Everyone else is refused, including the Club Advisor.',
    refusalReason: 'Not an authorised poster',
    passedTx: '0xec9f42c3aee54860222a41fbdc8ee11d7fe9b0eaf7d12e4306751dc0fff9773d',
    refusedTx: '0xd257bd631b24a9cc76984cabc3e6a0a90cc63a8818d7441089be5df9fb6ce540',
  },
  {
    rule: 2,
    title: 'The books can never go negative',
    description: 'An expense bigger than the balance is refused.',
    refusalReason: 'Expense exceeds club balance',
    passedTx: '0xb2e76df785986d8c6d34c6c2bda8d1cb39fe63ea6da12e3fd5846885980d3c8e',
    refusedTx: '0x09a7394a12ace66719cd6039ab7888a9f550612ea62e7b6259c3f2395fa166dd',
  },
  {
    rule: 3,
    title: 'A receipt can only be recorded once',
    description: 'A second entry with the same receipt number is refused.',
    refusalReason: 'Reference code already used',
    passedTx: '0xec9f42c3aee54860222a41fbdc8ee11d7fe9b0eaf7d12e4306751dc0fff9773d',
    refusedTx: '0xfc4b3fec2641bcde6acdbbebf34bc67dc20de5c8f1e21034e63397ba556bd8ba',
  },
  {
    rule: 4,
    title: 'Corrections, never edits',
    description: 'A fix is a new entry linked to the old one. The old one stays, and can’t be corrected twice.',
    refusalReason: 'Entry already corrected - correct the latest version',
    passedTx: '0xc46b612799926b6448845d8b3a033a44058c5cbae0d44f7c1f87c2df1375d7a9',
    refusedTx: '0x292a91339f29dc1b3cdabc6b1ade0bfbfed476085e559f2016f555e4b305a96d',
  },
]
