import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { subscriptionsDue, type DueRow } from '@/lib/data/subscriptions'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageSpinner } from '@/components/ui/Spinner'
import { errorMessage } from '@/lib/errorMessage'

const WINDOWS = [30, 60, 90, 365] as const

export default function RenewalsPage() {
  const navigate = useNavigate()
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(60)
  const [rows, setRows] = useState<DueRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRows(null)
    subscriptionsDue(days)
      .then(setRows)
      .catch((e) => setError(errorMessage(e)))
  }, [days])

  const columns: Column<DueRow>[] = [
    { header: 'School', render: (r) => <span className="font-700">{r.name}</span> },
    { header: 'Expiry', render: (r) => r.license_expires_on },
    {
      header: 'Days left',
      render: (r) => <span className={r.days_left < 0 ? 'text-danger' : r.days_left <= 14 ? 'text-warning' : ''}>{r.days_left}</span>,
    },
    { header: 'State', render: (r) => <Badge color={r.state === 'expired' ? 'danger' : 'success'}>{r.state}</Badge> },
    {
      header: 'Last reminder',
      render: (r) => (r.last_reminder_sent_at ? new Date(r.last_reminder_sent_at).toLocaleDateString() : '—'),
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <h1 className="font-display font-800 text-2xl mb-1">Renewals</h1>
      <p className="text-muted text-sm mb-6">Schools whose license expires within the selected window.</p>

      <div className="flex gap-2 mb-4">
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setDays(w)}
            className={`px-3 py-1.5 rounded-lg text-sm font-700 border ${
              days === w ? 'bg-primary text-white border-primary' : 'bg-surface text-ink border-border hover:bg-bg'
            }`}
          >
            {w}d
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {!rows ? (
        <PageSpinner />
      ) : (
        <Table
          rows={rows}
          columns={columns}
          emptyTitle="Nothing due"
          emptyMessage={`No school's license expires within ${days} days.`}
          onRowClick={(r) => navigate(`/schools/${r.school_id}`, { state: { tab: 'subscription' } })}
        />
      )}
    </motion.div>
  )
}
