import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { CopyButton } from './CopyButton'

export function SecretReveal({ value, onCopy }: { value: string; onCopy?: () => void }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-3 py-2">
      <code className="flex-1 text-sm font-mono truncate">{revealed ? value : '•'.repeat(Math.min(value.length, 32))}</code>
      <button
        onClick={() => setRevealed((r) => !r)}
        className="text-muted hover:text-ink shrink-0"
        aria-label={revealed ? 'Hide' : 'Reveal'}
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <CopyButton value={value} onCopy={onCopy} />
    </div>
  )
}
