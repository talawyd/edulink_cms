import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fetchActivityPage } from '@/lib/data/activity'
import { listSchoolOptions } from '@/lib/data/schools'
import type { Tables } from '@/types/database.types'
import { Table, type Column } from '@/components/ui/Table'
import { FieldSelect, FieldInput } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageSpinner } from '@/components/ui/Spinner'
import { errorMessage } from '@/lib/errorMessage'

const PAGE_SIZE = 25

type LogRow = Tables<'operations_log'>
type SchoolOption = { id: string; name: string; code: string }

export default function ActivityPage() {
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [schoolId, setSchoolId] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<LogRow[] | null>(null)
  const [count, setCount] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    listSchoolOptions()
      .then(setSchools)
      .catch(() => {})
  }, [])

  useEffect(() => {
    setRows(null)
    fetchActivityPage(page, PAGE_SIZE, { schoolId: schoolId || undefined, action: action || undefined })
      .then(({ rows, count }) => {
        setRows(rows)
        setCount(count)
        setError('')
      })
      .catch((e) => setError(errorMessage(e)))
  }, [page, schoolId, action])

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const columns: Column<LogRow>[] = [
    { header: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
    { header: 'Action', render: (r) => r.action },
    { header: 'School', render: (r) => schools.find((s) => s.id === r.school_id)?.name ?? '—' },
    { header: 'Details', render: (r) => <code className="text-xs">{JSON.stringify(r.details)}</code> },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="p-6 md:p-8 max-w-5xl"
    >
      <h1 className="font-display font-800 text-2xl mb-1">Activity</h1>
      <p className="text-muted text-sm mb-6">Everything logged across every school. Read only.</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <FieldSelect
          className="max-w-56"
          value={schoolId}
          onChange={(e) => {
            setSchoolId(e.target.value)
            setPage(0)
          }}
        >
          <option value="">All schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FieldSelect>
        <FieldInput
          className="max-w-56"
          placeholder="Filter by action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setPage(0)
          }}
        />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {!rows ? (
        <PageSpinner />
      ) : (
        <>
          <Table rows={rows} columns={columns} emptyTitle="No activity" pageSize={PAGE_SIZE} />
          {pageCount > 1 && (
            <div className="flex items-center justify-end gap-2 mt-3 text-sm text-muted">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <span>
                Page {page + 1} of {pageCount}
              </span>
              <Button size="sm" variant="ghost" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
