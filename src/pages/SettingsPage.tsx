import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import type { Tables } from '@/types/database.types'
import { getPlatformSettings, updatePlatformSettings } from '@/lib/data/settings'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, FieldInput } from '@/components/ui/FormField'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageSpinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errorMessage'

const CONFIRM_SENTENCE = 'require a second factor'

export default function SettingsPage() {
  const toast = useToast()
  const [settings, setSettings] = useState<Tables<'platform_settings'> | null>(null)
  const [error, setError] = useState('')

  const [graceDays, setGraceDays] = useState('')
  const [savingGrace, setSavingGrace] = useState(false)
  const [graceError, setGraceError] = useState('')

  const [mfaConfirmOpen, setMfaConfirmOpen] = useState(false)
  const [mfaBusy, setMfaBusy] = useState(false)

  async function load() {
    try {
      const s = await getPlatformSettings()
      setSettings(s)
      setGraceDays(String(s.default_grace_days))
      setError('')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSaveGrace(e: FormEvent) {
    e.preventDefault()
    setSavingGrace(true)
    setGraceError('')
    try {
      await updatePlatformSettings({ default_grace_days: Number(graceDays) })
      await load()
      toast('success', 'Saved.')
    } catch (e) {
      setGraceError(errorMessage(e))
    } finally {
      setSavingGrace(false)
    }
  }

  async function handleToggleMfa(next: boolean) {
    if (!next) {
      try {
        await updatePlatformSettings({ require_mfa: false })
        await load()
        toast('success', 'Second factor requirement turned off.')
      } catch (e) {
        toast('error', errorMessage(e))
      }
      return
    }
    setMfaConfirmOpen(true)
  }

  if (error) return <ErrorBanner message={error} />
  if (!settings) return <PageSpinner />

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="p-6 md:p-8 max-w-2xl space-y-6"
    >
      <div>
        <h1 className="font-display font-800 text-2xl">Settings</h1>
        <p className="text-muted text-sm">Platform-wide configuration.</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <h3 className="font-display font-700 mb-1">Platform domain</h3>
        <p className="text-sm text-muted mb-2">
          Changing this means changing every school's address, since a school's address is its code plus this
          domain. Not editable here.
        </p>
        <code className="text-sm font-mono bg-bg px-3 py-1.5 rounded-lg border border-border inline-block">
          {settings.platform_domain}
        </code>
      </div>

      <form onSubmit={handleSaveGrace} className="bg-surface border border-border rounded-2xl p-6 space-y-3">
        <h3 className="font-display font-700">Default grace days</h3>
        <p className="text-sm text-muted">
          Days after a license expires before a school is locked out, used when writing a school's licence row.
        </p>
        <div className="flex items-center gap-3">
          <FieldInput
            type="number"
            min="0"
            className="w-32"
            value={graceDays}
            onChange={(e) => setGraceDays(e.target.value)}
          />
          <Button type="submit" size="sm" loading={savingGrace}>
            Save
          </Button>
        </div>
        {graceError && <ErrorBanner message={graceError} />}
      </form>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-700">Require a second factor</h3>
            <p className="text-sm text-muted mt-1 max-w-md">
              When on, every team member must verify a TOTP code to use TPI Control.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={settings.require_mfa}
            onClick={() => handleToggleMfa(!settings.require_mfa)}
            className={`w-11 h-6 rounded-full transition-colors shrink-0 ${settings.require_mfa ? 'bg-primary' : 'bg-border'}`}
          >
            <span
              className={`block h-5 w-5 bg-white rounded-full shadow transition-transform ${settings.require_mfa ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>
      </div>

      <MfaConfirmModal
        open={mfaConfirmOpen}
        busy={mfaBusy}
        onClose={() => setMfaConfirmOpen(false)}
        onConfirm={async () => {
          setMfaBusy(true)
          try {
            await updatePlatformSettings({ require_mfa: true })
            await load()
            setMfaConfirmOpen(false)
            toast('success', 'Second factor is now required.')
          } catch (e) {
            toast('error', errorMessage(e))
          } finally {
            setMfaBusy(false)
          }
        }}
      />
    </motion.div>
  )
}

function MfaConfirmModal({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="Require a second factor?">
      <div className="space-y-4">
        <p className="text-sm text-ink">
          Turning this on locks out anyone who has not enrolled a second factor. If that happens, run:
        </p>
        <code className="block text-xs font-mono bg-bg px-3 py-2 rounded-lg border border-border">
          update public.platform_settings set require_mfa = false;
        </code>
        <p className="text-sm text-ink">in this project's SQL editor.</p>
        <FormField label={`Type "${CONFIRM_SENTENCE}" to confirm`}>
          <FieldInput value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={busy}
            disabled={typed.trim().toLowerCase() !== CONFIRM_SENTENCE}
          >
            Turn on
          </Button>
        </div>
      </div>
    </Modal>
  )
}
