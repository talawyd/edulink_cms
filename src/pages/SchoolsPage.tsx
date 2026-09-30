import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { listSchools, type SchoolListRow } from '@/lib/data/schools'
import { Table, type Column } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageSpinner } from '@/components/ui/Spinner'
import { FieldSelect } from '@/components/ui/FormField'
import { OnboardWizard } from '@/components/schools/OnboardWizard'

function daysLeft(dateStr: string | null) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  return diff
}

export default function SchoolsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<SchoolListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [wizardOpen, setWizardOpen] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setRows(await listSchools())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter)

  const columns: Column<SchoolListRow>[] = [
    { header: 'Name', render: (r) => <span className="font-700">{r.name}</span> },
    { header: 'Code', render: (r) => r.code },
    {
      header: 'Address',
      render: (r) => r.school_domains.find((d) => d.is_primary)?.hostname ?? r.school_domains[0]?.hostname ?? '—',
    },
    { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Expiry',
      render: (r) => {
        const left = daysLeft(r.subscriptions?.license_expires_on ?? null)
        if (left == null) return '—'
        return (
          <span className={left < 0 ? 'text-danger' : left <= 30 ? 'text-warning' : 'text-muted'}>
            {r.subscriptions!.license_expires_on} ({left}d)
          </span>
        )
      },
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="p-6 md:p-8 max-w-6xl"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-2xl">Schools</h1>
          <p className="text-muted text-sm">All onboarded schools and their addresses.</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4" />
          Onboard school
        </Button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          {rows.length > 0 && (
            <div className="mb-3 max-w-48">
              <FieldSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="offboarded">Offboarded</option>
              </FieldSelect>
            </div>
          )}
          <Table
            rows={filtered}
            columns={columns}
            searchable
            searchKey={(r) => `${r.name} ${r.code}`}
            emptyTitle="No schools yet"
            emptyMessage="Onboard the first school to get started."
            onRowClick={(r) => navigate(`/schools/${r.id}`)}
          />
        </>
      )}

      <OnboardWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(schoolId) => {
          setWizardOpen(false)
          navigate(`/schools/${schoolId}`)
        }}
      />
    </motion.div>
  )
}
