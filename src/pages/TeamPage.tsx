import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { UserPlus, Pencil, Check, X } from 'lucide-react'
import { listStaff, addStaff, setStaffActive, updateMyName, type StaffRow } from '@/lib/data/team'
import { EMAIL_PATTERN } from '@/lib/runbook'
import { useAuth } from '@/contexts/AuthContext'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField, FieldInput, FieldSelect } from '@/components/ui/FormField'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageSpinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errorMessage'

const ROLES = ['owner', 'engineer', 'support']

function MyNameCell({ row, onSaved }: { row: StaffRow; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(row.full_name)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="font-700">{row.full_name}</span>
        <button
          onClick={() => {
            setValue(row.full_name)
            setEditing(true)
          }}
          className="text-muted hover:text-ink"
          aria-label="Edit your name"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </span>
    )
  }

  async function handleSave() {
    setBusy(true)
    try {
      await updateMyName(value)
      await onSaved()
      setEditing(false)
      toast('success', 'Name updated.')
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <FieldInput
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 py-1"
      />
      <button onClick={handleSave} disabled={busy} className="text-success hover:opacity-80" aria-label="Save">
        <Check className="h-4 w-4" />
      </button>
      <button onClick={() => setEditing(false)} disabled={busy} className="text-muted hover:text-ink" aria-label="Cancel">
        <X className="h-4 w-4" />
      </button>
    </span>
  )
}

export default function TeamPage() {
  const toast = useToast()
  const { session } = useAuth()
  const [staff, setStaff] = useState<StaffRow[] | null>(null)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<StaffRow | null>(null)

  async function load() {
    try {
      setStaff(await listStaff())
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleReactivate(row: StaffRow) {
    try {
      await setStaffActive(row.user_id, true)
      await load()
      toast('success', `${row.full_name} reactivated.`)
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  const columns: Column<StaffRow>[] = [
    {
      header: 'Name',
      render: (r) =>
        r.user_id === session?.user.id ? (
          <MyNameCell row={r} onSaved={load} />
        ) : (
          <span className="font-700">{r.full_name}</span>
        ),
    },
    { header: 'Email', render: (r) => r.email },
    { header: 'Role', render: (r) => <Badge color="primary">{r.role}</Badge> },
    { header: 'Status', render: (r) => <Badge color={r.active ? 'success' : 'muted'}>{r.active ? 'active' : 'inactive'}</Badge> },
    {
      header: 'Last sign in',
      render: (r) => (r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : 'never'),
    },
    {
      header: '',
      render: (r) =>
        r.active ? (
          <Button size="sm" variant="danger" onClick={() => setDeactivateTarget(r)}>
            Deactivate
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => handleReactivate(r)}>
            Reactivate
          </Button>
        ),
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-2xl">Team</h1>
          <p className="text-muted text-sm">The three TPI owners and anyone else with access to this panel.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add member
        </Button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {!staff ? <PageSpinner /> : <Table rows={staff} columns={columns} emptyTitle="No team members yet" />}

      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={async () => {
          setAddOpen(false)
          await load()
          toast('success', 'Team member added.')
        }}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate team member?"
        description={`${deactivateTarget?.full_name} will no longer be able to sign in to TPI Control. They can be reactivated later.`}
        confirmLabel="Deactivate"
        danger
        onConfirm={async () => {
          if (!deactivateTarget) return
          await setStaffActive(deactivateTarget.user_id, false)
          await load()
          toast('success', `${deactivateTarget.full_name} deactivated.`)
        }}
      />
    </motion.div>
  )
}

function AddMemberModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('support')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setEmail('')
      setFullName('')
      setRole('support')
      setError('')
    }
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_PATTERN.test(email)) {
      setError('Enter a valid email.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await addStaff(email, fullName, role)
      await onAdded()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a team member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted">
          Their login must already exist in the Supabase dashboard (Authentication → Users) before you add them
          here — this only grants TPI Control access to an existing login.
        </p>
        <FormField label="Email">
          <FieldInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Full name">
          <FieldInput required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </FormField>
        <FormField label="Role">
          <FieldSelect value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </FieldSelect>
        </FormField>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  )
}
