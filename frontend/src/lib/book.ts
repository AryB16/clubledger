// The running ledger, worked out from the contract's entries. Pure, so it can be tested without a chain.
import type { Entry } from './ledger'

export interface BookLine {
  entry: Entry
  /** The amount before this correction, or undefined for an original entry. */
  was: bigint | undefined
  /** What this line adds to Money in. A correction adds only its difference, so this can be negative. */
  moneyIn: bigint | undefined
  /** What this line adds to Money out. */
  moneyOut: bigint | undefined
  /** What this line does to the balance. */
  effect: bigint
  /** The balance the contract held straight after this line. */
  balance: bigint
}

/** Takes every entry from id 1, oldest first. */
export function buildBook(entries: readonly Entry[]): BookLine[] {
  const amounts = new Map<bigint, bigint>()
  let balance = 0n
  return entries.map((entry) => {
    let was: bigint | undefined
    if (entry.correctsId !== 0n) {
      was = amounts.get(entry.correctsId)
      if (was === undefined) throw new Error(`Entry ${entry.id} corrects one that hasn't been read`)
    }
    amounts.set(entry.id, entry.amount)
    const change = entry.amount - (was ?? 0n)
    const income = entry.kind === 0
    const effect = income ? change : -change
    balance += effect
    return { entry, was, moneyIn: income ? change : undefined, moneyOut: income ? undefined : change, effect, balance }
  })
}
