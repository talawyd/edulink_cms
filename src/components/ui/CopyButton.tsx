import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyButton({
  value,
  label = 'Copy',
  onCopy,
}: {
  value: string
  label?: string
  onCopy?: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    onCopy?.()
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-sm font-700 text-primary hover:text-primary-dark"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : label}
    </button>
  )
}
