import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

export default function MfaPromptPage() {
  const { refreshMfaStatus, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) {
      setError(listError.message)
      setLoading(false)
      return
    }
    const factor = factors.totp[0]
    if (!factor) {
      setError('No verified authenticator factor found.')
      setLoading(false)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    })
    if (verifyError) {
      setError(verifyError.message)
      setLoading(false)
      return
    }
    await refreshMfaStatus()
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8"
      >
        <div className="text-center mb-6">
          <span className="inline-block text-xs font-800 tracking-wider bg-primary text-white rounded px-2 py-1 mb-3">
            TPI CONTROL
          </span>
          <h1 className="font-display font-800 text-xl">Enter your code</h1>
          <p className="text-sm text-muted mt-1">Open your authenticator app and enter the 6-digit code.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full text-center tracking-[0.5em] text-lg px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {error && <ErrorBanner message={error} />}
          <Button type="submit" className="w-full" loading={loading}>
            Verify
          </Button>
          <button
            type="button"
            onClick={signOut}
            className="w-full text-sm text-muted hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </motion.div>
    </div>
  )
}
