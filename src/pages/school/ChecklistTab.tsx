import { useState } from 'react'
import { Check } from 'lucide-react'
import type { SchoolDetail } from '@/lib/data/schools'
import { setChecklistStep, clearChecklistStep } from '@/lib/data/schools'
import { CHECKLIST_STEPS } from '@/lib/constants'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { errorMessage } from '@/lib/errorMessage'

export function ChecklistTab({ detail, onReload }: { detail: SchoolDetail; onReload: () => Promise<void> }) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  const done = new Map(detail.checklist.map((c) => [c.step_key, c]))
  const progress = Math.round((done.size / CHECKLIST_STEPS.length) * 100)

  async function toggle(key: string) {
    setBusyKey(key)
    setError('')
    try {
      if (done.has(key)) {
        await clearChecklistStep(detail.school.id, key)
      } else {
        await setChecklistStep(detail.school.id, key)
      }
      await onReload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-700">Onboarding progress</span>
          <span className="text-muted">
            {done.size} / {CHECKLIST_STEPS.length}
          </span>
        </div>
        <div className="h-2 bg-bg rounded-full overflow-hidden border border-border">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {CHECKLIST_STEPS.map((step) => {
          const row = done.get(step.key)
          return (
            <button
              key={step.key}
              onClick={() => toggle(step.key)}
              disabled={busyKey === step.key}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg disabled:opacity-50"
            >
              <span
                className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                  row ? 'bg-success border-success' : 'border-border'
                }`}
              >
                {row && <Check className="h-3.5 w-3.5 text-white" />}
              </span>
              <span className="flex-1">
                <span className="text-sm font-700">{step.label}</span>
                {row && (
                  <span className="block text-xs text-muted">
                    {row.done_by ?? 'unknown'} · {new Date(row.done_at).toLocaleString()}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
