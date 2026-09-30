import { NavLink } from 'react-router-dom'
import { School, RefreshCw, Users, Settings, Activity, ShieldCheck } from 'lucide-react'

const NAV = [
  { to: '/schools', label: 'Schools', icon: School },
  { to: '/renewals', label: 'Renewals', icon: RefreshCw },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/security', label: 'Security', icon: ShieldCheck },
]

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-sidebar text-white min-h-screen">
      <div className="px-5 py-5 border-b border-white/10">
        <span className="inline-block text-xs font-800 tracking-wider bg-primary text-white rounded px-2 py-1">
          TPI CONTROL
        </span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-700 transition-colors ${
                isActive ? 'bg-primary text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
