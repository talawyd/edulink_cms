import { useAuth } from '@/contexts/AuthContext'

export default function NotOnTeamPage() {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8 text-center">
        <span className="inline-block text-xs font-800 tracking-wider bg-primary text-white rounded px-2 py-1 mb-4">
          TPI CONTROL
        </span>
        <p className="font-display font-700 text-ink">Your account is not on the TPI team</p>
        <p className="text-sm text-muted mt-2">Your session is still active. Sign out when you're ready.</p>
        <button onClick={signOut} className="mt-4 text-sm text-muted hover:text-ink underline">
          Sign out
        </button>
      </div>
    </div>
  )
}
