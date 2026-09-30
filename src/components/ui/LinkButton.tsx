import type { AnchorHTMLAttributes } from 'react'
import { buttonBase, buttonVariants, buttonSizes, type ButtonVariant, type ButtonSize } from './buttonStyles'

// A single <a> styled as a button — never a <button> nested inside an <a>.
// That nesting is invalid HTML (interactive content can't nest) and some
// browsers won't reliably fire the anchor's default navigation, especially
// for external protocol links like mailto:, when the click target is the
// nested descendant instead of the anchor itself.
export function LinkButton({
  variant = 'secondary',
  size = 'sm',
  className = '',
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <a className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`} {...rest}>
      {children}
    </a>
  )
}
