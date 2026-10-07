import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import type { Tables } from '@/types/database.types'
import { getPlatformSettings, updatePlatformSettings } from '@/lib/data/settings'
import { canManageHostingPools, listHostingPools, registerHostingPool, type HostingPool } from '@/lib/data/hostingPools'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FormField, FieldInput, FieldSelect } from '@/components/ui/FormField'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageSpinner } from '@/components/ui/Spinner'
import { Table, type Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
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

  const [canManagePools, setCanManagePools] = useState(false)

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
    canManageHostingPools().then(setCanManagePools).catch(() => setCanManagePools(false))
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
      className="space-y-6"
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

      {canManagePools && <HostingPoolsCard />}

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

function HostingPoolsCard() {
  const toast = useToast()
  const [pools, setPools] = useState<HostingPool[] | null>(null)
  const [listError, setListError] = useState('')

  const [label, setLabel] = useState('')
  const [kind, setKind] = useState('private')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  async function load() {
    try {
      setPools(await listHostingPools())
      setListError('')
    } catch (e) {
      setListError(errorMessage(e))
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFormError('')
    try {
      await registerHostingPool(label, kind, url, key)
      setLabel('')
      setKind('private')
      setUrl('')
      setKey('')
      await load()
      toast('success', 'Hosting pool registered.')
    } catch (e) {
      setFormError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<HostingPool>[] = [
    { header: 'Label', render: (r) => <span className="font-700">{r.label}</span> },
    { header: 'Kind', render: (r) => <Badge color="primary">{r.kind}</Badge> },
    { header: 'URL', render: (r) => <span className="font-mono text-xs">{r.supabase_url}</span> },
  ]

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <h3 className="font-display font-700 mb-1">Hosting pools</h3>
      <p className="text-sm text-muted mb-4">
        Shared Supabase projects a school can be onboarded onto during pooled setup.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Label">
            <FieldInput value={label} onChange={(e) => setLabel(e.target.value)} required />
          </FormField>
          <FormField label="Kind">
            <FieldSelect value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="private">private</option>
              <option value="public">public</option>
            </FieldSelect>
          </FormField>
        </div>
        <FormField label="Supabase project URL">
          <FieldInput
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
            required
          />
        </FormField>
        <FormField label="Publishable key">
          <FieldInput value={key} onChange={(e) => setKey(e.target.value)} required />
        </FormField>
        {formError && <ErrorBanner message={formError} />}
        <Button type="submit" size="sm" loading={busy}>
          Register pool
        </Button>
      </form>

      {listError && <ErrorBanner message={listError} />}
      {!pools ? <PageSpinner /> : <Table rows={pools} columns={columns} emptyTitle="No hosting pools registered yet" />}
    </div>
  )
}
