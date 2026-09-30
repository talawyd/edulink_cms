import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { getSchool, type SchoolDetail } from '@/lib/data/schools'
import { getPlatformSettings } from '@/lib/data/settings'
import { PLATFORM_DOMAIN_FALLBACK } from '@/lib/constants'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { StatusBadge } from '@/components/ui/Badge'
import { Tabs, TabPanel } from '@/components/ui/Tabs'
import { OverviewTab } from './OverviewTab'
import { ChecklistTab } from './ChecklistTab'
import { RunbookTab } from './RunbookTab'
import { ActivityTab } from './ActivityTab'
import { errorMessage } from '@/lib/errorMessage'

type TabKey = 'overview' | 'checklist' | 'runbook' | 'activity'

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<SchoolDetail | null>(null)
  const [platformDomain, setPlatformDomain] = useState(PLATFORM_DOMAIN_FALLBACK)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabKey>('overview')

  const load = useCallback(async () => {
    if (!id) return
    try {
      setDetail(await getSchool(id))
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [id])

  useEffect(() => {
    load()
    getPlatformSettings()
      .then((s) => setPlatformDomain(s.platform_domain))
      .catch(() => {})
  }, [load])

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <ErrorBanner message={error} />
      </div>
    )
  }

  if (!detail) return <PageSpinner />

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="p-6 md:p-8 max-w-4xl"
    >
      <Link to="/schools" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-4">
        <ArrowLeft className="h-4 w-4" /> Schools
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-display font-800 text-2xl">{detail.school.name}</h1>
        <StatusBadge status={detail.school.status} />
      </div>

      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'checklist', label: 'Checklist' },
          { key: 'runbook', label: 'Runbook' },
          { key: 'activity', label: 'Activity' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-6">
        <TabPanel tabKey={tab}>
          {tab === 'overview' && <OverviewTab detail={detail} platformDomain={platformDomain} onReload={load} />}
          {tab === 'checklist' && <ChecklistTab detail={detail} onReload={load} />}
          {tab === 'runbook' && <RunbookTab detail={detail} />}
          {tab === 'activity' && <ActivityTab schoolId={detail.school.id} />}
        </TabPanel>
      </div>
    </motion.div>
  )
}
