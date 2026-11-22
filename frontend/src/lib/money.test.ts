import { describe, expect, it } from 'vitest'
import { filsToInput, formatAed, parseAedToFils } from './money'

describe('parseAedToFils', () => {
  it.each([
    ['1,250.50', 125050n],
    ['1250.5', 125050n],
    ['1250', 125000n],
    ['0.01', 1n],
    ['0', 0n],
    ['5,000.00', 500000n],
    ['50,000', 5000000n],
    ['1,234,567.89', 123456789n],
    ['  380.00 ', 38000n],
    ['AED 420', 42000n],
    ['999999999999999999.99', 99999999999999999999n],
  ])('%s → %s', (input, fils) => {
    expect(parseAedToFils(input)).toBe(fils)
  })

  it.each(['', 'abc', '1.234', '-5', '1,25.00', '12,34', '1.', '.5', '1e3', '1 000', '١٢٣'])('rejects %j', (input) => {
    expect(parseAedToFils(input)).toBeNull()
  })

  it('never goes through floating point (0.1 + 0.2 style inputs stay exact)', () => {
    expect(parseAedToFils('0.10')! + parseAedToFils('0.20')!).toBe(30n)
  })
})

describe('formatAed', () => {
  it('formats with AED and two decimals', () => {
    const s = formatAed(458000n)
    expect(s).toContain('4,580.00')
    expect(s).toMatch(/AED/)
    expect(s.toLowerCase()).not.toContain('fils')
  })
  it('formats zero', () => {
    expect(formatAed(0n)).toContain('0.00')
  })
})

describe('filsToInput', () => {
  it.each([
    [38000n, '380.00'],
    [1n, '0.01'],
    [0n, '0.00'],
    [125050n, '1250.50'],
  ])('%s → %s', (fils, s) => {
    expect(filsToInput(fils)).toBe(s)
    expect(parseAedToFils(s)).toBe(fils)
  })
})
