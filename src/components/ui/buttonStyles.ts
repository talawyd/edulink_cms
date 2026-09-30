export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export const buttonBase = 'inline-flex items-center justify-center rounded-lg font-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'bg-surface text-ink border border-border hover:bg-bg',
  ghost: 'text-ink hover:bg-bg',
  danger: 'bg-danger text-white hover:bg-danger/90',
}

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-5 py-2.5 gap-2',
}
