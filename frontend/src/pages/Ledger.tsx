import { useState } from 'react'
import { correctedSet, statusOf, useAllEntries, useLabels } from '../lib/ledger'
import { EntryCard, EntryCardSkeleton, ErrorNotice, PageHead, Statement } from '../components/ui'

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
    <>
      <PageHead title="All entries">
        <p className="mt-4 max-w-xl leading-relaxed text-forest-100 sm:text-lg">
          Newest first. A correction gets its own line, and the line it fixes stays.
        </p>
        <p className="mt-1 h-6 text-forest-200 tabular-nums">{total !== undefined && `${total.toString()} in total`}</p>
      </PageHead>
      <div className="wrap space-y-5 py-7 sm:py-10">
        <div role="tablist" aria-label="Filter entries" className="inline-flex gap-1 rounded-full bg-sand p-1">
          {(['All', 'Income', 'Expense'] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`min-h-11 rounded-full px-5 text-sm font-semibold transition-colors ${
                filter === f ? 'bg-forest-900 text-white' : 'text-ink hover:bg-paper'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {q.isError && all.length === 0 ? (
          <ErrorNotice onRetry={() => q.summary.refetch()} />
        ) : (
          <Statement>
            {q.isPending ? (
              Array.from({ length: 6 }, (_, i) => <EntryCardSkeleton key={i} />)
            ) : shown.length === 0 ? (
              <p className="p-6 text-muted">
                {all.length === 0 ? 'Nothing has been recorded yet.' : `No ${filter.toLowerCase()} entries yet.`}
              </p>
            ) : (
              shown.map((e) => <EntryCard key={e.id.toString()} e={e} status={statusOf(e, corrected)} label={label(e.poster)} />)
            )}
          </Statement>
        )}
        {q.hasNextPage && (
          <button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="btn btn-quiet w-full">
            {q.isFetchingNextPage ? 'Loading…' : 'Show older entries'}
          </button>
        )}
      </div>
    </>
  )
}
