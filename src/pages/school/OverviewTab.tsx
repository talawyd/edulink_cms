import { useState, type FormEvent } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import type { SchoolDetail } from '@/lib/data/schools'
import { updateSchoolProject, setSchoolStatus, testAddress, type ResolvedSchool } from '@/lib/data/schools'
import { supabaseDashboardLinks, schoolAddress } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField, FieldInput, FieldSelect, FieldTextarea } from '@/components/ui/FormField'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { StatusBadge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errorMessage'

const STATUSES = ['pending', 'active', 'suspended', 'offboarded']

export function OverviewTab({
  detail,
  platformDomain,
  onReload,
}: {
  detail: SchoolDetail
  platformDomain: string
  onReload: () => Promise<void>
}) {
  const toast = useToast()
  const { school, project, domains } = detail
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState(school.status)
  const [reason, setReason] = useState('')
  const [testResult, setTestResult] = useState<ResolvedSchool | null | 'pending'>(null)
  const [testError, setTestError] = useState('')

  const address = domains.find((d) => d.is_primary)?.hostname ?? schoolAddress(school.code, platformDomain)
  const links = project ? supabaseDashboardLinks(project.supabase_project_ref) : null

  async function handleTestAddress() {
    setTestResult('pending')
    setTestError('')
    try {
      const result = await testAddress(address)
      setTestResult(result)
    } catch (e) {
      setTestError(errorMessage(e))
      setTestResult(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl p-6 grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <p className="text-xs text-muted">Name</p>
          <p className="text-sm font-700">{school.name}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Code</p>
          <p className="text-sm font-700">{school.code}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Address</p>
          <p className="text-sm font-700">{address}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Status</p>
          <StatusBadge status={school.status} />
        </div>
        <div>
          <p className="text-xs text-muted">Plan</p>
          <p className="text-sm font-700">{school.plan}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Contact</p>
          <p className="text-sm font-700">{school.contact_name ?? '—'}</p>
          <p className="text-xs text-muted">{school.contact_email ?? '—'}</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-700">Connection</h3>
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            Edit connection
          </Button>
        </div>
        {project ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-muted">Project URL</p>
              <p className="font-mono">{project.supabase_url}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Region</p>
              <p>{project.region}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Publishable key</p>
              <p className="font-mono">{project.anon_key.slice(0, 15)}…</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">No connection on file.</p>
        )}
        {links && (
          <div className="flex flex-wrap gap-2 mt-4">
            <a href={links.users} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary">
                Users <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
            <a href={links.sqlEditor} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary">
                SQL editor <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
            <a href={links.apiKeys} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary">
                API keys <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-700">Test address</h3>
          <Button size="sm" variant="secondary" onClick={handleTestAddress} loading={testResult === 'pending'}>
            <RefreshCw className="h-3.5 w-3.5" /> Test
          </Button>
        </div>
        {testError && <ErrorBanner message={testError} />}
        {testResult && testResult !== 'pending' && (
          <div className="text-sm space-y-1">
            <p>
              Status: <StatusBadge status={testResult.status} />
            </p>
            <p className="text-muted">Project: {testResult.supabase_url}</p>
            <p className="text-muted font-mono">Key: {testResult.anon_key.slice(0, 15)}…</p>
          </div>
        )}
        {testResult === null && !testError && <p className="text-sm text-muted">Not tested yet.</p>}
      </div>

      <div>
        <Button variant="danger" size="sm" onClick={() => setStatusOpen(true)}>
          Change status
        </Button>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit connection">
        <EditConnectionForm
          schoolId={school.id}
          project={project}
          onSaved={async () => {
            setEditOpen(false)
            await onReload()
            toast('success', 'Connection updated.')
          }}
        />
      </Modal>

      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Change status">
        <div className="space-y-4">
          <FormField label="New status">
            <FieldSelect value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </FieldSelect>
          </FormField>
          <FormField label="Reason">
            <FieldTextarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <p className="text-xs text-muted">
            {nextStatus === 'suspended' && 'The school will be marked suspended. Its address stops resolving until reactivated.'}
            {nextStatus === 'offboarded' && 'The school will be marked offboarded, not deleted. Nothing is removed.'}
          </p>
        </div>
        <StatusConfirmFooter
          schoolId={school.id}
          status={nextStatus}
          reason={reason}
          onClose={() => setStatusOpen(false)}
          onDone={async () => {
            setStatusOpen(false)
            await onReload()
            toast('success', 'Status updated.')
          }}
        />
      </Modal>
    </div>
  )
}

function EditConnectionForm({
  schoolId,
  project,
  onSaved,
}: {
  schoolId: string
  project: SchoolDetail['project']
  onSaved: () => Promise<void>
}) {
  const [url, setUrl] = useState(project?.supabase_url ?? '')
  const [key, setKey] = useState('')
  const [region, setRegion] = useState(project?.region ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = key.trim()
    if (trimmed.startsWith('sb_secret_') || trimmed.startsWith('eyJ')) {
      setError('That looks like a secret key. Only the publishable key goes here.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateSchoolProject(schoolId, url, trimmed, region)
      await onSaved()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Project URL">
        <FieldInput type="url" required value={url} onChange={(e) => setUrl(e.target.value)} />
      </FormField>
      <FormField label="New publishable key" hint="This replaces the stored key. Only the publishable key goes here.">
        <FieldInput required placeholder="sb_publishable_..." value={key} onChange={(e) => setKey(e.target.value)} />
      </FormField>
      <FormField label="Region">
        <FieldInput required value={region} onChange={(e) => setRegion(e.target.value)} />
      </FormField>
      {error && <ErrorBanner message={error} />}
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          Save
        </Button>
      </div>
    </form>
  )
}

function StatusConfirmFooter({
  schoolId,
  status,
  reason,
  onClose,
  onDone,
}: {
  schoolId: string
  status: string
  reason: string
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Continue
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Set status to ${status}?`}
        description={`This school's status will be changed to "${status}". Reason: ${reason || '(none given)'}`}
        confirmLabel="Change status"
        danger
        onConfirm={async () => {
          await setSchoolStatus(schoolId, status, reason)
          await onDone()
        }}
      />
    </>
  )
}
