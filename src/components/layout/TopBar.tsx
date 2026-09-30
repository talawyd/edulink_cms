import { LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/Badge'

export function TopBar() {
  const { staff, signOut } = useAuth()

  return (
    <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-between px-6">
      <span className="lg:hidden text-xs font-800 tracking-wider bg-primary text-white rounded px-2 py-1">
        TPI CONTROL
      </span>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-3">
        {staff && (
          <>
            <span className="text-sm font-700 text-ink">{staff.full_name}</span>
            <Badge color="primary">{staff.role}</Badge>
          </>
        )}
        <button onClick={signOut} className="text-muted hover:text-ink" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
