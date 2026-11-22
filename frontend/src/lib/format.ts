const dt = new Intl.DateTimeFormat('en-AE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Dubai',
})
const d = new Intl.DateTimeFormat('en-AE', { dateStyle: 'medium', timeZone: 'Asia/Dubai' })

export const formatDateTime = (ts: bigint) => dt.format(new Date(Number(ts) * 1000))
export const formatDate = (ts: bigint) => d.format(new Date(Number(ts) * 1000))
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
/** Display only. The contract keeps the full name, so never use this for a value that gets written back. */
export const shownName = (s: string) => s.replace(/\s*\(fictional\)$/, '')
export const normaliseCode = (s: string) => s.trim().toUpperCase()
