import { useEffect, useState, type FormEvent } from 'react'
import type { SchoolDetail } from '@/lib/data/schools'
import { logOperation } from '@/lib/data/schools'
import {
  updateSubscription,
  createLicenseSecret,
  rotateLicenseSecret,
  generateLicenseKey,
  markLicenseKeySent,
  listLicenseKeys,
} from '@/lib/data/subscriptions'
import type { Tables } from '@/types/database.types'
import { keyEmail, reminderEmail } from '@/lib/emailTemplates'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormField, FieldInput, FieldSelect } from '@/components/ui/FormField'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { SecretReveal } from '@/components/ui/SecretReveal'
import { CopyButton } from '@/components/ui/CopyButton'
import { Table, type Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/errorMessage'

type KeyRow = Tables<'license_keys'>

export function SubscriptionTab({
  detail,
  onReload,
  onSecretIssued,
}: {
  detail: SchoolDetail
  onReload: () => Promise<void>
  onSecretIssued: (secret: string) => void
}) {
  const toast = useToast()
  const { school, subscription } = detail

  // -- edit plan / cycle / price --
  const [plan, setPlan] = useState(subscription?.plan ?? '')
  const [billingCycle, setBillingCycle] = useState(subscription?.billing_cycle ?? 'annual')
  const [price, setPrice] = useState(subscription ? String(subscription.price_amount) : '')
  const [savingSub, setSavingSub] = useState(false)
  const [subError, setSubError] = useState('')

  useEffect(() => {
    setPlan(subscription?.plan ?? '')
    setBillingCycle(subscription?.billing_cycle ?? 'annual')
    setPrice(subscription ? String(subscription.price_amount) : '')
  }, [subscription])

  async function handleSaveSubscription(e: FormEvent) {
    e.preventDefault()
    setSavingSub(true)
    setSubError('')
    try {
      await updateSubscription(school.id, plan, billingCycle, Number(price))
      await onReload()
      toast('success', 'Subscription updated.')
    } catch (e) {
      setSubError(errorMessage(e))
    } finally {
      setSavingSub(false)
    }
  }

  // -- signing secret --
  const [secretBusy, setSecretBusy] = useState<'create' | 'rotate' | null>(null)
  const [secretError, setSecretError] = useState('')
  const [revealedSecret, setRevealedSecret] = useState('')
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false)

  async function handleCreateSecret() {
    setSecretBusy('create')
    setSecretError('')
    try {
      const secret = await createLicenseSecret(school.id)
      setRevealedSecret(secret)
      onSecretIssued(secret)
    } catch (e) {
      setSecretError(errorMessage(e))
    } finally {
      setSecretBusy(null)
    }
  }

  async function handleRotateSecret() {
    const secret = await rotateLicenseSecret(school.id)
    setRevealedSecret(secret)
    onSecretIssued(secret)
  }

  // -- generate key --
  const [keys, setKeys] = useState<KeyRow[] | null>(null)
  const [keysError, setKeysError] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const [genError, setGenError] = useState('')
  const [lastKey, setLastKey] = useState<{ key: string; expiresOn: string } | null>(null)

  async function loadKeys() {
    try {
      setKeys(await listLicenseKeys(school.id))
      setKeysError('')
    } catch (e) {
      setKeysError(errorMessage(e))
    }
  }

  useEffect(() => {
    loadKeys()
  }, [school.id])

  async function handleGenerateKey() {
    setGenBusy(true)
    setGenError('')
    try {
      const result = await generateLicenseKey(school.id)
      setLastKey({ key: result.key, expiresOn: result.expires_on })
      await loadKeys()
      await onReload()
    } catch (e) {
      setGenError(errorMessage(e))
    } finally {
      setGenBusy(false)
    }
  }

  async function handleMarkSent(row: KeyRow) {
    if (!school.contact_email) return
    try {
      await markLicenseKeySent(row.id, school.contact_email)
      await loadKeys()
      await onReload()
      toast('success', 'Marked as sent.')
    } catch (e) {
      toast('error', errorMessage(e))
    }
  }

  function handleSendReminder() {
    if (!subscription?.license_expires_on || !school.contact_email) return
    logOperation('renewal_reminder_prepared', school.id, { license_expires_on: subscription.license_expires_on }).catch(
      () => {},
    )
  }

  const keyColumns: Column<KeyRow>[] = [
    { header: 'Key', render: (r) => <span className="font-mono text-xs">{r.key_text}</span> },
    { header: 'Expires', render: (r) => r.expires_on },
    { header: 'Issued', render: (r) => new Date(r.issued_at).toLocaleDateString() },
    {
      header: 'Sent',
      render: (r) =>
        r.sent_at ? (
          <span className="text-muted">
            {new Date(r.sent_at).toLocaleDateString()} → {r.sent_to}
          </span>
        ) : school.contact_email ? (
          <div className="flex items-center gap-3">
            <a href={keyEmail(school.name, school.contact_email, r.expires_on, r.key_text)}>
              <Button size="sm" variant="secondary">
                Email
              </Button>
            </a>
            <Button size="sm" variant="ghost" onClick={() => handleMarkSent(r)}>
              Mark as sent
            </Button>
          </div>
        ) : (
          <span className="text-muted italic">No contact email on file</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h3 className="font-display font-700 mb-4">Subscription</h3>
        {!subscription ? (
          <p className="text-sm text-muted">No subscription record yet.</p>
        ) : (
          <form onSubmit={handleSaveSubscription} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Plan">
                <FieldInput value={plan} onChange={(e) => setPlan(e.target.value)} required />
              </FormField>
              <FormField label="Billing cycle">
                <FieldSelect value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </FieldSelect>
              </FormField>
              <FormField label="Price">
                <FieldInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </FormField>
            </div>
            <p className="text-sm text-muted">
              Expires <span className="font-700 text-ink">{subscription.license_expires_on ?? '—'}</span>
            </p>
            {subError && <ErrorBanner message={subError} />}
            <Button type="submit" size="sm" loading={savingSub}>
              Save
            </Button>
          </form>
        )}
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <h3 className="font-display font-700 mb-1">Signing secret</h3>
        <p className="text-sm text-muted mb-4">
          Shown once. Used to fill runbook step 3 (first setup) or step 4 (after rotating). Never stored here.
        </p>
        <div className="flex gap-2 mb-4">
          <Button size="sm" variant="secondary" onClick={handleCreateSecret} loading={secretBusy === 'create'}>
            Create signing secret
          </Button>
          <Button size="sm" variant="danger" onClick={() => setRotateConfirmOpen(true)}>
            Rotate signing secret
          </Button>
        </div>
        {secretError && <ErrorBanner message={secretError} />}
        {revealedSecret && <SecretReveal value={revealedSecret} />}
        <ConfirmDialog
          open={rotateConfirmOpen}
          onClose={() => setRotateConfirmOpen(false)}
          onConfirm={handleRotateSecret}
          title="Rotate signing secret?"
          description="This replaces the school's signing secret. Any activation key already issued under the old secret stops working. The school will need the new key from the updated runbook step 4."
          confirmLabel="Rotate secret"
          danger
        />
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-700">Activation keys</h3>
          <Button size="sm" onClick={handleGenerateKey} loading={genBusy}>
            Generate key
          </Button>
        </div>
        {genError && (
          <div className="mb-4">
            <ErrorBanner message={genError} />
          </div>
        )}
        {lastKey && (
          <div className="mb-4 bg-bg border border-border rounded-lg p-4">
            <p className="text-xs text-muted mb-1">New key — expires {lastKey.expiresOn}</p>
            <div className="flex items-center gap-3">
              <code className="text-xl font-mono font-700 tracking-wide">{lastKey.key}</code>
              <CopyButton value={lastKey.key} />
            </div>
          </div>
        )}
        {keysError && <ErrorBanner message={keysError} />}
        {keys && <Table rows={keys} columns={keyColumns} emptyTitle="No keys issued yet" />}
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <h3 className="font-display font-700 mb-1">Renewal reminder</h3>
        <p className="text-sm text-muted mb-4">Sends no email itself — opens your mail client with the message prefilled.</p>
        {subscription?.license_expires_on && school.contact_email ? (
          <a href={reminderEmail(school.name, school.contact_email, subscription.license_expires_on)}>
            <Button size="sm" variant="secondary" onClick={handleSendReminder}>
              Prepare reminder email
            </Button>
          </a>
        ) : (
          <p className="text-sm text-muted italic">Needs a subscription expiry and a contact email on file.</p>
        )}
      </div>
    </div>
  )
}
