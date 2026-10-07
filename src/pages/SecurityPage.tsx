import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { Factor } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'

type EnrollState = {
  factorId: string
  qrCode: string
  secret: string
}

export default function SecurityPage() {
  const { refreshMfaStatus } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [factors, setFactors] = useState<Factor[]>([])
  const [error, setError] = useState('')
  const [enrolling, setEnrolling] = useState<EnrollState | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  async function loadFactors() {
    setLoading(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      setError(error.message)
    } else {
      setFactors(data.all)
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadFactors()
  }, [])

  async function startEnroll() {
    setBusy(true)
    setError('')
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `authenticator-${Date.now()}`,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
  }

  async function handleVerify() {
    if (!enrolling) return
    setBusy(true)
    setVerifyError('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.factorId,
      code,
    })
    setBusy(false)
    if (error) {
      setVerifyError(error.message)
      return
    }
    setEnrolling(null)
    setCode('')
    toast('success', 'Authenticator verified.')
    await loadFactors()
    await refreshMfaStatus()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <h1 className="font-display font-800 text-2xl mb-1">Security</h1>
      <p className="text-muted text-sm mb-6">Manage the authenticator app for your account.</p>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {loading ? (
        <PageSpinner />
      ) : factors.length === 0 && !enrolling ? (
        <EmptyState title="No authenticator enrolled" message="Add one to enable two-factor sign-in." />
      ) : (
        <div className="space-y-2 mb-6">
          {factors.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3"
            >
              <div>
                <p className="text-sm font-700">{f.friendly_name ?? f.factor_type}</p>
                <p className="text-xs text-muted">Added {new Date(f.created_at).toLocaleString()}</p>
              </div>
              <Badge color={f.status === 'verified' ? 'success' : 'warning'}>{f.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {!enrolling ? (
        <Button onClick={startEnroll} loading={busy}>
          Add authenticator
        </Button>
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <p className="text-sm font-700">Scan this QR code with your authenticator app</p>
          <div
            className="w-40 h-40 bg-white p-2 rounded-lg border border-border [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
            dangerouslySetInnerHTML={{ __html: enrolling.qrCode }}
          />
          <div>
            <p className="text-xs text-muted mb-1">Or enter this code manually</p>
            <code className="text-sm font-mono bg-bg px-3 py-1.5 rounded-lg border border-border inline-block">
              {enrolling.secret}
            </code>
          </div>
          <div>
            <label className="block text-sm font-700 mb-1">Enter the 6-digit code to verify</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-40 text-center tracking-[0.4em] px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {verifyError && <ErrorBanner message={verifyError} />}
          <div className="flex gap-2">
            <Button onClick={handleVerify} loading={busy} disabled={code.length !== 6}>
              Verify
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEnrolling(null)
                setCode('')
                setVerifyError('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
