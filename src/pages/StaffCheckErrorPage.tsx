import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

export default function StaffCheckErrorPage() {
  const { staffCheckError, refreshStaff, signOut } = useAuth()
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    setRetrying(true)
    await refreshStaff()
    setRetrying(false)
  }

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8 text-center">
        <span className="inline-block text-xs font-800 tracking-wider bg-primary text-white rounded px-2 py-1 mb-4">
          TPI CONTROL
        </span>
        <p className="font-display font-700 text-ink">Couldn't verify your access</p>
        <p className="text-sm text-muted mt-2 mb-4">Check your connection and try again. You're still signed in.</p>
        {staffCheckError && (
          <div className="mb-4 text-left">
            <ErrorBanner message={staffCheckError} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button onClick={handleRetry} loading={retrying} className="w-full">
            Try again
          </Button>
          <button onClick={signOut} className="text-sm text-muted hover:text-ink">
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
