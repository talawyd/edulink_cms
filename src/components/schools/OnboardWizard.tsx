import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { FormField, FieldInput, FieldSelect } from '@/components/ui/FormField'
import { createSchool, setChecklistStep, type CreateSchoolResult } from '@/lib/data/schools'
import { getPlatformSettings } from '@/lib/data/settings'
import { schoolAddress } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { errorMessage } from '@/lib/errorMessage'

const BLOCKED_KEY_PREFIXES = ['sb_secret_', 'eyJ']

const initialForm = {
  code: '',
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  supabaseUrl: '',
  publishableKey: '',
  region: '',
  plan: 'standard',
  billingCycle: 'annual',
  price: '',
}

export function OnboardWizard({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (schoolId: string) => void
}) {
  const { staff } = useAuth()
  const [platformDomain, setPlatformDomain] = useState('')
  const [form, setForm] = useState(initialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CreateSchoolResult | null>(null)

  useEffect(() => {
    if (open) {
      getPlatformSettings()
        .then((s) => setPlatformDomain(s.platform_domain))
        .catch(() => {})
    } else {
      setForm(initialForm)
      setError('')
      setResult(null)
    }
  }, [open])

  function set<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const key = form.publishableKey.trim()
    if (BLOCKED_KEY_PREFIXES.some((p) => key.startsWith(p))) {
      setError('That looks like a secret key, not a publishable key. Only the publishable key (starts sb_publishable_) goes here.')
      return
    }

    setBusy(true)
    try {
      const created = await createSchool({
        code: form.code,
        name: form.name,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        supabaseUrl: form.supabaseUrl,
        publishableKey: key,
        region: form.region,
        plan: form.plan,
        billingCycle: form.billingCycle,
        price: Number(form.price),
      })
      await setChecklistStep(created.school_id, 'registered_in_tpic', staff?.full_name ?? 'TPIC')
      setResult(created)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const address = form.code ? schoolAddress(form.code, platformDomain || 'edulink.live') : ''

  if (result) {
    return (
      <Modal open={open} onClose={onClose} title="School created" maxWidth="max-w-xl">
        <div className="space-y-4">
          <p className="text-sm text-ink">
            <span className="font-700">{form.name}</span> was created at <span className="font-mono">{result.hostname}</span>.
          </p>
          <p className="text-sm text-ink">
            License expires on <span className="font-700">{result.license_expires_on}</span>.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => onCreated(result.school_id)}>Open school</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Onboard a school" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Code" hint={address ? `Address will be ${address}` : 'Lowercase letters and digits, starting with a letter.'}>
          <FieldInput
            required
            pattern="^[a-z][a-z0-9]{1,29}$"
            value={form.code}
            onChange={(e) => set('code', e.target.value.toLowerCase())}
          />
        </FormField>
        <FormField label="School name">
          <FieldInput required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Contact name">
            <FieldInput required value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
          </FormField>
          <FormField label="Contact phone">
            <FieldInput required value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Contact email">
          <FieldInput
            type="email"
            required
            value={form.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
          />
        </FormField>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted mb-3">
            Find these in the school's own Supabase project under Settings → API Keys. Only the publishable key
            (starts <code>sb_publishable_</code>) goes here — never the secret key.
          </p>
          <FormField label="Project URL">
            <FieldInput
              type="url"
              required
              placeholder="https://xxxxx.supabase.co"
              value={form.supabaseUrl}
              onChange={(e) => set('supabaseUrl', e.target.value)}
            />
          </FormField>
          <div className="mt-4">
            <FormField label="Publishable key">
              <FieldInput
                required
                placeholder="sb_publishable_..."
                value={form.publishableKey}
                onChange={(e) => set('publishableKey', e.target.value)}
              />
            </FormField>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Region">
            <FieldInput required value={form.region} onChange={(e) => set('region', e.target.value)} />
          </FormField>
          <FormField label="Plan">
            <FieldInput required value={form.plan} onChange={(e) => set('plan', e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Billing cycle">
            <FieldSelect value={form.billingCycle} onChange={(e) => set('billingCycle', e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </FieldSelect>
          </FormField>
          <FormField label="Price" hint="The first license period is set automatically to one year from today.">
            <FieldInput
              type="number"
              step="0.01"
              min="0"
              required
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </FormField>
        </div>

        {error && <ErrorBanner message={error} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create school
          </Button>
        </div>
      </form>
    </Modal>
  )
}
