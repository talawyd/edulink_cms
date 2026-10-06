import { useEffect, useState, type FormEvent } from 'react'
import { Server, Building2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { FormField, FieldInput, FieldSelect } from '@/components/ui/FormField'
import { setChecklistStep } from '@/lib/data/schools'
import {
  listHostingPools,
  createSchoolShared,
  createSchoolDedicated,
  type HostingPool,
  type CreateSchoolSharedResult,
  type CreateSchoolDedicatedResult,
} from '@/lib/data/hostingPools'
import { getPlatformSettings } from '@/lib/data/settings'
import { schoolAddress } from '@/lib/constants'
import { errorMessage } from '@/lib/errorMessage'

type Mode = 'mode' | 'shared' | 'dedicated'

const sharedInitialForm = {
  code: '',
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  poolLabel: '',
  plan: 'standard',
  billingCycle: 'annual',
  price: '',
}

const dedicatedInitialForm = {
  code: '',
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  schoolType: 'private',
  region: '',
  plan: 'standard',
  billingCycle: 'annual',
  price: '',
}

type SharedResult = { kind: 'shared'; result: CreateSchoolSharedResult }
type DedicatedResult = { kind: 'dedicated'; result: CreateSchoolDedicatedResult }

export function OnboardWizard({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (schoolId: string) => void
}) {
  const [mode, setMode] = useState<Mode>('mode')
  const [platformDomain, setPlatformDomain] = useState('')
  const [result, setResult] = useState<SharedResult | DedicatedResult | null>(null)

  useEffect(() => {
    if (open) {
      getPlatformSettings()
        .then((s) => setPlatformDomain(s.platform_domain))
        .catch(() => {})
    } else {
      setMode('mode')
      setResult(null)
    }
  }, [open])

  async function finish(schoolId: string, r: SharedResult | DedicatedResult) {
    await setChecklistStep(schoolId, 'registered_in_tpic')
    setResult(r)
  }

  if (result) {
    return (
      <Modal open={open} onClose={onClose} title="School created" maxWidth="max-w-xl">
        <div className="space-y-4">
          {result.kind === 'shared' ? (
            <>
              <p className="text-sm text-ink">
                Created at <span className="font-mono">{result.result.hostname}</span>, hosted on pool{' '}
                <span className="font-700">{result.result.pool}</span>.
              </p>
              <p className="text-sm text-ink">
                License expires on <span className="font-700">{result.result.license_expires_on}</span>.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-ink">
                Created at <span className="font-mono">{result.result.hostname}</span>.
              </p>
              <p className="text-sm text-ink">
                Awaiting its own Supabase project — attach it from the school's Overview tab once that project
                exists.
              </p>
            </>
          )}
          <div className="flex justify-end">
            <Button onClick={() => onCreated(result.result.school_id)}>Open school</Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (mode === 'mode') {
    return (
      <Modal open={open} onClose={onClose} title="Onboard a school" maxWidth="max-w-xl">
        <p className="text-sm text-muted mb-4">How should this school be hosted?</p>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMode('shared')}
            className="text-left bg-surface border border-border rounded-xl p-5 hover:border-primary hover:bg-primary-muted/30 transition-colors"
          >
            <Server className="h-5 w-5 text-primary mb-2" />
            <p className="font-700 text-sm">Shared</p>
            <p className="text-xs text-muted mt-1">Reuse a known pool's connection. Nothing to type or paste.</p>
          </button>
          <button
            onClick={() => setMode('dedicated')}
            className="text-left bg-surface border border-border rounded-xl p-5 hover:border-primary hover:bg-primary-muted/30 transition-colors"
          >
            <Building2 className="h-5 w-5 text-primary mb-2" />
            <p className="font-700 text-sm">Dedicated</p>
            <p className="text-xs text-muted mt-1">
              The school gets its own project. Connect it later, once that project exists.
            </p>
          </button>
        </div>
      </Modal>
    )
  }

  if (mode === 'shared') {
    return (
      <SharedForm
        open={open}
        platformDomain={platformDomain}
        onBack={() => setMode('mode')}
        onClose={onClose}
        onCreated={(schoolId, result) => finish(schoolId, { kind: 'shared', result })}
      />
    )
  }

  return (
    <DedicatedForm
      open={open}
      platformDomain={platformDomain}
      onBack={() => setMode('mode')}
      onClose={onClose}
      onCreated={(schoolId, result) => finish(schoolId, { kind: 'dedicated', result })}
    />
  )
}

function ContactFields({
  contactName,
  contactPhone,
  contactEmail,
  onChange,
}: {
  contactName: string
  contactPhone: string
  contactEmail: string
  onChange: (field: 'contactName' | 'contactPhone' | 'contactEmail', value: string) => void
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Contact name">
          <FieldInput required value={contactName} onChange={(e) => onChange('contactName', e.target.value)} />
        </FormField>
        <FormField label="Contact phone">
          <FieldInput required value={contactPhone} onChange={(e) => onChange('contactPhone', e.target.value)} />
        </FormField>
      </div>
      <FormField label="Contact email">
        <FieldInput type="email" required value={contactEmail} onChange={(e) => onChange('contactEmail', e.target.value)} />
      </FormField>
    </>
  )
}

function PlanFields({
  plan,
  billingCycle,
  price,
  onChange,
}: {
  plan: string
  billingCycle: string
  price: string
  onChange: (field: 'plan' | 'billingCycle' | 'price', value: string) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <FormField label="Plan">
        <FieldInput required value={plan} onChange={(e) => onChange('plan', e.target.value)} />
      </FormField>
      <FormField label="Billing cycle">
        <FieldSelect value={billingCycle} onChange={(e) => onChange('billingCycle', e.target.value)}>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </FieldSelect>
      </FormField>
      <FormField label="Price" hint="First period: one year from today.">
        <FieldInput type="number" step="0.01" min="0" required value={price} onChange={(e) => onChange('price', e.target.value)} />
      </FormField>
    </div>
  )
}

function SharedForm({
  open,
  platformDomain,
  onBack,
  onClose,
  onCreated,
}: {
  open: boolean
  platformDomain: string
  onBack: () => void
  onClose: () => void
  onCreated: (schoolId: string, result: CreateSchoolSharedResult) => void
}) {
  const [form, setForm] = useState(sharedInitialForm)
  const [pools, setPools] = useState<HostingPool[]>([])
  const [poolsError, setPoolsError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    listHostingPools()
      .then((p) => {
        setPools(p)
        setPoolsError('')
        if (p.length > 0) setForm((f) => ({ ...f, poolLabel: f.poolLabel || p[0].label }))
      })
      .catch((e) => setPoolsError(errorMessage(e)))
  }, [open])

  function set<K extends keyof typeof sharedInitialForm>(key: K, value: (typeof sharedInitialForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const created = await createSchoolShared({
        code: form.code,
        name: form.name,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        poolLabel: form.poolLabel,
        plan: form.plan,
        billingCycle: form.billingCycle,
        price: Number(form.price),
      })
      onCreated(created.school_id, created)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const address = form.code ? schoolAddress(form.code, platformDomain || 'edulink.live') : ''

  return (
    <Modal open={open} onClose={onClose} title="Onboard a school — shared hosting" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Code" hint={address ? `Address will be ${address}` : 'Lowercase letters and digits, starting with a letter.'}>
          <FieldInput required pattern="^[a-z][a-z0-9]{1,29}$" value={form.code} onChange={(e) => set('code', e.target.value.toLowerCase())} />
        </FormField>
        <FormField label="School name">
          <FieldInput required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </FormField>
        <ContactFields
          contactName={form.contactName}
          contactPhone={form.contactPhone}
          contactEmail={form.contactEmail}
          onChange={set}
        />

        <FormField label="Hosting pool">
          {poolsError ? (
            <ErrorBanner message={poolsError} />
          ) : pools.length === 0 ? (
            <p className="text-sm text-muted italic">No hosting pools registered yet.</p>
          ) : (
            <FieldSelect required value={form.poolLabel} onChange={(e) => set('poolLabel', e.target.value)}>
              {pools.map((p) => (
                <option key={p.id} value={p.label}>
                  {p.label} ({p.kind})
                </option>
              ))}
            </FieldSelect>
          )}
        </FormField>

        <PlanFields plan={form.plan} billingCycle={form.billingCycle} price={form.price} onChange={set} />

        {error && <ErrorBanner message={error} />}

        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={pools.length === 0}>
              Create school
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function DedicatedForm({
  open,
  platformDomain,
  onBack,
  onClose,
  onCreated,
}: {
  open: boolean
  platformDomain: string
  onBack: () => void
  onClose: () => void
  onCreated: (schoolId: string, result: CreateSchoolDedicatedResult) => void
}) {
  const [form, setForm] = useState(dedicatedInitialForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof typeof dedicatedInitialForm>(key: K, value: (typeof dedicatedInitialForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const created = await createSchoolDedicated({
        code: form.code,
        name: form.name,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        schoolType: form.schoolType,
        region: form.region,
        plan: form.plan,
        billingCycle: form.billingCycle,
        price: Number(form.price),
      })
      onCreated(created.school_id, created)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const address = form.code ? schoolAddress(form.code, platformDomain || 'edulink.live') : ''

  return (
    <Modal open={open} onClose={onClose} title="Onboard a school — dedicated hosting" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted">
          No project yet? That's fine — create the school now and attach its Supabase project later from the
          Overview tab, once it exists.
        </p>
        <FormField label="Code" hint={address ? `Address will be ${address}` : 'Lowercase letters and digits, starting with a letter.'}>
          <FieldInput required pattern="^[a-z][a-z0-9]{1,29}$" value={form.code} onChange={(e) => set('code', e.target.value.toLowerCase())} />
        </FormField>
        <FormField label="School name">
          <FieldInput required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </FormField>
        <ContactFields
          contactName={form.contactName}
          contactPhone={form.contactPhone}
          contactEmail={form.contactEmail}
          onChange={set}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField label="School type">
            <FieldSelect value={form.schoolType} onChange={(e) => set('schoolType', e.target.value)}>
              <option value="private">Private</option>
              <option value="public">Public</option>
            </FieldSelect>
          </FormField>
          <FormField label="Region">
            <FieldInput required value={form.region} onChange={(e) => set('region', e.target.value)} />
          </FormField>
        </div>

        <PlanFields plan={form.plan} billingCycle={form.billingCycle} price={form.price} onChange={set} />

        {error && <ErrorBanner message={error} />}

        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create school
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
