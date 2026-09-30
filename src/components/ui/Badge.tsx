const colors: Record<string, string> = {
  primary: 'bg-primary-muted text-primary',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
  violet: 'bg-violet-muted text-violet',
  muted: 'bg-bg text-muted',
}

export function Badge({ color = 'muted', children }: { color?: keyof typeof colors; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-700 ${colors[color]}`}>
      {children}
    </span>
  )
}

const schoolStatusColor: Record<string, keyof typeof colors> = {
  pending: 'warning',
  active: 'success',
  suspended: 'danger',
  offboarded: 'muted',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge color={schoolStatusColor[status] ?? 'muted'}>{status}</Badge>
}
