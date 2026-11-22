// Money helpers. Amounts are bigint fils (AED × 100). No floating point in parsing or arithmetic.

const AMOUNT_RE = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/

/** Parse "1,250.50" / "1250.5" / "1250" into fils. Returns null for anything that isn't a plain amount. */
export function parseAedToFils(input: string): bigint | null {
  const s = input.trim().replace(/^AED\s*/i, '')
  const m = AMOUNT_RE.exec(s)
  if (!m) return null
  const whole = BigInt(m[1].replace(/,/g, ''))
  const frac = BigInt((m[2] ?? '').padEnd(2, '0') || '0')
  return whole * 100n + frac
}

const fmt = new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' })

/** Display fils as e.g. "AED 4,580.00". */
export function formatAed(fils: bigint): string {
  return fmt.format(Number(fils) / 100)
}

/** Plain editable amount, e.g. 38000n → "380.00" (string maths, no floats). */
export function filsToInput(fils: bigint): string {
  const neg = fils < 0n
  const abs = neg ? -fils : fils
  const whole = abs / 100n
  const frac = (abs % 100n).toString().padStart(2, '0')
  return `${neg ? '-' : ''}${whole}.${frac}`
}
