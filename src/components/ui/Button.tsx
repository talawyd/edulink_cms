import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'
import { buttonBase, buttonVariants, buttonSizes, type ButtonVariant, type ButtonSize } from './buttonStyles'

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean }) {
  return (
    <button
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4 border-current/30 border-t-current" />}
      {children}
    </button>
  )
}
