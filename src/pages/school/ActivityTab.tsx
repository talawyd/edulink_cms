import { useEffect, useState } from 'react'
import { fetchSchoolActivity } from '@/lib/data/schools'
import type { Tables } from '@/types/database.types'
import { Table, type Column } from '@/components/ui/Table'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageSpinner } from '@/components/ui/Spinner'
import { errorMessage } from '@/lib/errorMessage'

type LogRow = Tables<'operations_log'>

export function ActivityTab({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<LogRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSchoolActivity(schoolId)
      .then(setRows)
      .catch((e) => setError(errorMessage(e)))
  }, [schoolId])

  const columns: Column<LogRow>[] = [
    { header: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
    { header: 'Action', render: (r) => r.action },
    { header: 'Details', render: (r) => <code className="text-xs">{JSON.stringify(r.details)}</code> },
  ]

  if (error) return <ErrorBanner message={error} />
  if (!rows) return <PageSpinner />

  return <Table rows={rows} columns={columns} emptyTitle="No activity yet" />
}
