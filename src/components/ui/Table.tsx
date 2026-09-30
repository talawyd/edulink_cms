import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { EmptyState } from './EmptyState'

export type Column<T> = {
  header: string
  render: (row: T) => React.ReactNode
}

export function Table<T>({
  rows,
  columns,
  searchable = false,
  searchKey,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  pageSize = 20,
  onRowClick,
}: {
  rows: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchKey?: (row: T) => string
  emptyTitle?: string
  emptyMessage?: string
  pageSize?: number
  onRowClick?: (row: T) => void
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!searchable || !query || !searchKey) return rows
    const q = query.toLowerCase()
    return rows.filter((r) => searchKey(r).toLowerCase().includes(q))
  }, [rows, query, searchable, searchKey])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />
  }

  return (
    <div>
      {searchable && (
        <div className="relative mb-3 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Search"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState title="No matches" message="Try a different search." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                {columns.map((c) => (
                  <th key={c.header} className="px-4 py-2.5 font-700">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-border last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-bg' : ''}`}
                >
                  {columns.map((c) => (
                    <td key={c.header} className="px-4 py-2.5">
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 mt-3 text-sm text-muted">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-2 py-1 rounded disabled:opacity-40 hover:bg-bg"
          >
            Prev
          </button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <button
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 rounded disabled:opacity-40 hover:bg-bg"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
