import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { listStaff } from '@/lib/data/team'

export function TopBar() {
  const { session, signOut } = useAuth()
  const [fullName, setFullName] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    listStaff()
      .then((rows) => setFullName(rows.find((r) => r.user_id === session.user.id)?.full_name ?? null))
      .catch(() => setFullName(null))
  }, [session])

  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-between px-6">
      <span className="lg:hidden text-xs font-800 tracking-wider bg-primary text-white rounded px-2 py-1">
        TPI CONTROL
      </span>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-3">
        {session && <span className="text-sm font-700 text-ink">{fullName || session.user.email}</span>}
        <button onClick={signOut} className="text-muted hover:text-ink" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
