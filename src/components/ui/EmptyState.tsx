import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon?: LucideIcon
  title: string
  message?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && <Icon className="h-10 w-10 text-muted mb-3" strokeWidth={1.5} />}
      <p className="font-display font-700 text-ink">{title}</p>
      {message && <p className="text-sm text-muted mt-1 max-w-sm">{message}</p>}
    </div>
  )
}
