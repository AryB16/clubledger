// Contract reads (view functions only — never event logs). Everything shown on the site comes from here.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { CLUBLEDGER_ABI } from '../abi/abi'
import { CONTRACT_ADDRESS } from '../config'
import { publicClient } from './client'

export interface Entry {
  id: bigint
  kind: number // 0 Income, 1 Expense
  amount: bigint
  category: string
  counterparty: string
  description: string
  refCode: string
  poster: Address
  timestamp: bigint
  correctsId: bigint
  reason: string
}

export interface Summary {
  clubName: string
  admin: Address
  balance: bigint
  totalIncome: bigint
  totalExpense: bigint
  entryCount: bigint
}

const c = { address: CONTRACT_ADDRESS, abi: CLUBLEDGER_ABI } as const

export async function readSummary(): Promise<Summary> {
  const [clubName, admin, balance, totalIncome, totalExpense, entryCount] = await publicClient.readContract({
    ...c,
    functionName: 'summary',
  })
  return { clubName, admin, balance, totalIncome, totalExpense, entryCount }
}

export async function readEntry(id: bigint): Promise<Entry> {
  return (await publicClient.readContract({ ...c, functionName: 'getEntry', args: [id] })) as Entry
}

export async function readEntries(startId: bigint, count: bigint): Promise<Entry[]> {
  return [...((await publicClient.readContract({ ...c, functionName: 'getEntries', args: [startId, count] })) as Entry[])]
}

export async function readVersions(code: string): Promise<Entry[]> {
  const ids = await publicClient.readContract({ ...c, functionName: 'versionsOf', args: [code] })
  return Promise.all(ids.map(readEntry))
}

export async function readRole(addr: Address): Promise<{ isPoster: boolean; label: string }> {
  const [isPoster, label] = await Promise.all([
    publicClient.readContract({ ...c, functionName: 'isPoster', args: [addr] }),
    publicClient.readContract({ ...c, functionName: 'posterLabel', args: [addr] }),
  ])
  return { isPoster, label }
}

// ── hooks ──

export const useSummary = () => useQuery({ queryKey: ['summary'], queryFn: readSummary })

export const useVersions = (code: string) =>
  useQuery({ queryKey: ['versions', code], queryFn: () => readVersions(code), enabled: code.length > 0 })

export const useRole = (addr: Address | undefined) =>
  useQuery({ queryKey: ['role', addr], queryFn: () => readRole(addr!), enabled: !!addr })

/** The n most recent entries, newest first. */
export function useRecent(n: number) {
  const s = useSummary()
  const count = s.data?.entryCount
  const q = useQuery({
    queryKey: ['recent', n, count?.toString()],
    enabled: count !== undefined,
    queryFn: async () => {
      if (!count) return []
      const start = count > BigInt(n) ? count - BigInt(n) + 1n : 1n
      return (await readEntries(start, BigInt(n))).reverse()
    },
  })
  return { ...q, isPending: s.isPending || q.isPending, isError: s.isError || q.isError, refetch: () => s.refetch() }
}

export const PAGE = 50n

/** All entries, newest first, fetched 50 at a time with getEntries. */
export function useAllEntries() {
  const s = useSummary()
  const count = s.data?.entryCount
  const q = useInfiniteQuery({
    queryKey: ['entries', count?.toString()],
    enabled: count !== undefined,
    initialPageParam: count ?? 0n,
    queryFn: async ({ pageParam }) => {
      const end = pageParam as bigint // newest id on this page
      if (end < 1n) return [] as Entry[]
      const start = end > PAGE ? end - PAGE + 1n : 1n
      return (await readEntries(start, end - start + 1n)).reverse()
    },
    getNextPageParam: (last) => {
      if (last.length === 0) return undefined
      const oldest = last[last.length - 1].id
      return oldest > 1n ? oldest - 1n : undefined
    },
  })
  return { ...q, summary: s, isPending: s.isPending || q.isPending, isError: s.isError || q.isError }
}

/** Labels for a set of addresses: the contract's posterLabel, "Club Advisor" for the admin. */
export function useLabels(addrs: readonly Address[]) {
  const s = useSummary()
  const unique = [...new Set(addrs.map((a) => a.toLowerCase()))].sort() as Address[]
  const q = useQuery({
    queryKey: ['labels', unique.join(',')],
    enabled: unique.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const out: Record<string, { label: string; isPoster: boolean }> = {}
      await Promise.all(
        unique.map(async (a) => {
          out[a] = await readRole(a)
        }),
      )
      return out
    },
  })
  return (addr: Address) => {
    const a = addr.toLowerCase()
    if (s.data && a === s.data.admin.toLowerCase()) return 'Club Advisor'
    const r = q.data?.[a]
    if (!r) return '…'
    if (!r.label) return 'Unknown'
    return r.isPoster ? r.label : `${r.label} (former)`
  }
}

export type Status = 'Latest' | 'Corrected' | 'Correction' | 'Cancelled'

/** Status badge for an entry, given the set of ids that have been corrected. */
export function statusOf(e: Entry, correctedIds: Set<bigint>): Status {
  if (correctedIds.has(e.id)) return 'Corrected'
  if (e.correctsId !== 0n && e.amount === 0n) return 'Cancelled'
  if (e.correctsId !== 0n) return 'Correction'
  return 'Latest'
}

export const correctedSet = (entries: Entry[]) => new Set(entries.filter((e) => e.correctsId !== 0n).map((e) => e.correctsId))

export type Verdict = 'GENUINE' | 'CORRECTED' | 'CANCELLED' | 'NOT_FOUND'

/** SPEC §3.3: [] NOT FOUND · 1 GENUINE · >1 and latest amount 0 CANCELLED · else CORRECTED. */
export function verdictOf(versions: Entry[]): Verdict {
  if (versions.length === 0) return 'NOT_FOUND'
  if (versions.length === 1) return 'GENUINE'
  return versions[versions.length - 1].amount === 0n ? 'CANCELLED' : 'CORRECTED'
}
