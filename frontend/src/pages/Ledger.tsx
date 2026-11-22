import { useState } from 'react'
import { correctedSet, statusOf, useAllEntries, useLabels } from '../lib/ledger'
import { Card, EntryCard, EntryCardSkeleton, ErrorNotice } from '../components/ui'

type Filter = 'All' | 'Income' | 'Expense'

export default function Ledger() {
  const [filter, setFilter] = useState<Filter>('All')
  const q = useAllEntries()
  const all = q.data?.pages.flat() ?? []
  const label = useLabels(all.map((e) => e.poster))
  const corrected = correctedSet(all)
  const shown = all.filter((e) => filter === 'All' || (filter === 'Income' ? e.kind === 0 : e.kind === 1))
  const total = q.summary.data?.entryCount

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">All entries</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every entry ever recorded, newest first. Corrections appear as their own entries — nothing is overwritten.
          {total !== undefined && <span className="text-slate-400"> · {total.toString()} in total</span>}
        </p>
      </div>
      <div role="tablist" aria-label="Filter entries" className="inline-flex rounded-2xl bg-slate-100 p-1">
        {(['All', 'Income', 'Expense'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
              filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {q.isError && all.length === 0 ? (
          <ErrorNotice onRetry={() => q.summary.refetch()} />
        ) : q.isPending ? (
          Array.from({ length: 6 }, (_, i) => <EntryCardSkeleton key={i} />)
        ) : shown.length === 0 ? (
          <Card className="p-4 text-sm text-slate-600">
            {all.length === 0 ? 'Nothing has been recorded yet.' : `No ${filter.toLowerCase()} entries yet.`}
          </Card>
        ) : (
          shown.map((e) => <EntryCard key={e.id.toString()} e={e} status={statusOf(e, corrected)} label={label(e.poster)} />)
        )}
      </div>
      {q.hasNextPage && (
        <button
          onClick={() => q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
          className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {q.isFetchingNextPage ? 'Loading…' : 'Show older entries'}
        </button>
      )}
    </div>
  )
}
