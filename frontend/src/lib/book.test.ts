import { describe, expect, it } from 'vitest'
import { buildBook } from './book'
import type { Entry } from './ledger'

const e = (id: number, kind: number, amount: bigint, corrects = 0) =>
  ({ id: BigInt(id), kind, amount, correctsId: BigInt(corrects) }) as Entry

describe('buildBook', () => {
  it('follows the seed data to the recorded balance and totals', () => {
    const lines = buildBook([
      e(1, 0, 500000n), e(2, 0, 120000n), e(3, 0, 250000n), e(4, 1, 185000n), e(5, 1, 42000n), e(6, 1, 90000n),
      e(7, 1, 30000n), e(8, 0, 75000n), e(9, 1, 64000n), e(10, 1, 110000n), e(11, 1, 38000n, 5), e(12, 1, 0n, 7),
    ])
    expect(lines.map((l) => l.balance)).toEqual([500000n, 620000n, 870000n, 685000n, 643000n, 553000n, 523000n, 598000n, 534000n, 424000n, 428000n, 458000n])
    expect(lines.reduce((s, l) => s + (l.moneyIn ?? 0n), 0n)).toBe(945000n)
    expect(lines.reduce((s, l) => s + (l.moneyOut ?? 0n), 0n)).toBe(487000n)
    expect(lines[10]).toMatchObject({ was: 42000n, moneyOut: -4000n, effect: 4000n })
  })

  it('follows a chain through income correction, cancellation and reinstatement', () => {
    const lines = buildBook([e(1, 0, 1000n), e(2, 0, 700n, 1), e(3, 0, 0n, 2), e(4, 0, 900n, 3)])
    expect(lines.map((l) => l.moneyIn)).toEqual([1000n, -300n, -700n, 900n])
    expect(lines.map((l) => l.balance)).toEqual([1000n, 700n, 0n, 900n])
  })

  it('treats a correction of details only as no movement', () => {
    expect(buildBook([e(1, 0, 500n), e(2, 0, 500n, 1)])[1]).toMatchObject({ effect: 0n, balance: 500n })
  })

  it('refuses to guess when an earlier version is missing', () => {
    expect(() => buildBook([e(9, 1, 100n, 3)])).toThrow()
  })
})
