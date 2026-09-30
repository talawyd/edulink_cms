import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteSchool } from '@/lib/data/schools'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, FieldInput } from '@/components/ui/FormField'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { errorMessage } from '@/lib/errorMessage'

export function DeleteSchoolSection({ schoolId, code }: { schoolId: string; code: string }) {
  const { staff } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (staff?.role !== 'owner') return null

  async function handleDelete() {
    setBusy(true)
    setError('')
    try {
      await deleteSchool(schoolId, typed)
      navigate('/schools')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-danger/30 rounded-2xl p-6 bg-danger-muted/30">
      <h3 className="font-display font-700 text-danger mb-1">Delete school</h3>
      <p className="text-sm text-muted mb-4">
        Permanently deletes this school and everything tied to it: its connection, address, subscription, signing
        secret, issued keys, and checklist. This cannot be undone. Use this only for a school that was never real —
        a typo or a test entry. For a real customer who leaves, offboard instead.
      </p>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setOpen(true)
          setTyped('')
          setError('')
        }}
      >
        Delete school
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Delete this school">
        <div className="space-y-4">
          <p className="text-sm text-ink">
            This permanently deletes <span className="font-700">{code}</span> and everything tied to it: its
            connection, address, subscription, signing secret, issued keys, and checklist. Its past activity log
            entries are kept, but the school itself is gone for good. This cannot be undone.
          </p>
          <FormField label={`Type "${code}" to confirm`}>
            <FieldInput value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </FormField>
          {error && <ErrorBanner message={error} />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={busy} disabled={typed !== code}>
              Delete permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
