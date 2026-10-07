import { useState } from 'react'
import type { SchoolDetail } from '@/lib/data/schools'
import { logOperation } from '@/lib/data/schools'
import { supabaseDashboardLinks } from '@/lib/constants'
import {
  schoolSettingsSql,
  firstAdminSql,
  licenceRowSql,
  rotateSecretSql,
  forgottenPasswordSql,
  generatePassword,
  EMAIL_PATTERN,
} from '@/lib/runbook'
import { CopyButton } from '@/components/ui/CopyButton'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { FormField, FieldInput } from '@/components/ui/FormField'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { useAuth } from '@/contexts/AuthContext'

function RunbookCard({
  step,
  title,
  description,
  sql,
  sqlEditorUrl,
  onCopy,
  disabled,
  disabledReason,
}: {
  step: number
  title: string
  description: string
  sql: string | null
  sqlEditorUrl?: string
  onCopy?: () => void
  disabled?: boolean
  disabledReason?: string
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <p className="text-xs text-muted mb-1">Step {step}</p>
      <h3 className="font-display font-700 mb-1">{title}</h3>
      <p className="text-sm text-muted mb-3">{description}</p>
      {disabled ? (
        <p className="text-sm text-muted italic">{disabledReason}</p>
      ) : (
        sql && (
          <>
            <pre className="text-xs font-mono bg-bg border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap mb-3">
              {sql}
            </pre>
            <div className="flex items-center gap-4">
              <CopyButton value={sql} onCopy={onCopy} />
              {sqlEditorUrl && (
                <LinkButton href={sqlEditorUrl} target="_blank" rel="noreferrer">
                  Open SQL editor
                </LinkButton>
              )}
            </div>
          </>
        )
      )}
    </div>
  )
}

export function RunbookTab({
  detail,
  defaultGraceDays,
  signingSecret,
}: {
  detail: SchoolDetail
  defaultGraceDays: number
  signingSecret: string
}) {
  const { school, project, subscription } = detail
  const sqlEditorUrl = project ? supabaseDashboardLinks(project.supabase_project_ref).sqlEditor : undefined

  const [adminEmail, setAdminEmail] = useState('')
  const [adminName, setAdminName] = useState('')

  const [pwEmail, setPwEmail] = useState('')
  const [pwEmailError, setPwEmailError] = useState('')
  const [tempPassword, setTempPassword] = useState('')

  const { session } = useAuth()

  function log(action: string) {
    logOperation(action, school.id).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <RunbookCard
        step={1}
        title="School settings row"
        description="Run this in the school's own SQL editor to register its identity."
        sql={schoolSettingsSql(school.code, school.name)}
        sqlEditorUrl={sqlEditorUrl}
        onCopy={() => log('runbook_school_settings_copied')}
      />

      <div className="bg-surface border border-border rounded-2xl p-6">
        <p className="text-xs text-muted mb-1">Step 2</p>
        <h3 className="font-display font-700 mb-1">First admin</h3>
        <p className="text-sm text-muted mb-3">
          After you create the login in the school's Supabase dashboard (Users), fill in the same email here to
          generate the profile and role rows.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <FormField label="Admin email">
            <FieldInput type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </FormField>
          <FormField label="Admin full name">
            <FieldInput value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          </FormField>
        </div>
        {adminEmail && adminName && EMAIL_PATTERN.test(adminEmail) ? (
          <>
            <pre className="text-xs font-mono bg-bg border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap mb-3">
              {firstAdminSql(adminEmail, adminName, session?.user.email ?? 'TPIC')}
            </pre>
            <div className="flex items-center gap-4">
              <CopyButton
                value={firstAdminSql(adminEmail, adminName, session?.user.email ?? 'TPIC')}
                onCopy={() => log('runbook_first_admin_copied')}
              />
              {sqlEditorUrl && (
                <LinkButton href={sqlEditorUrl} target="_blank" rel="noreferrer">
                  Open SQL editor
                </LinkButton>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted italic">Enter a valid email and name to generate the SQL.</p>
        )}
      </div>

      <RunbookCard
        step={3}
        title="Licence row"
        description="Uses the signing secret just created for this school and its subscription expiry."
        sql={
          signingSecret && subscription?.license_expires_on
            ? licenceRowSql(subscription.license_expires_on, defaultGraceDays, signingSecret)
            : null
        }
        sqlEditorUrl={sqlEditorUrl}
        onCopy={() => log('runbook_licence_row_copied')}
        disabled={!signingSecret || !subscription?.license_expires_on}
        disabledReason="Create a signing secret in the Subscription tab first — it's shown once, right here, when you do."
      />

      <RunbookCard
        step={4}
        title="After rotating the signing secret"
        description="Updates the school's stored secret to match the one just rotated."
        sql={signingSecret ? rotateSecretSql(signingSecret) : null}
        sqlEditorUrl={sqlEditorUrl}
        onCopy={() => log('runbook_secret_rotated_copied')}
        disabled={!signingSecret}
        disabledReason="Rotate the signing secret in the Subscription tab first — it's shown once, right here, when you do."
      />

      <div className="bg-surface border border-border rounded-2xl p-6">
        <p className="text-xs text-muted mb-1">Step 5</p>
        <h3 className="font-display font-700 mb-1">Forgotten admin password</h3>
        <p className="text-sm text-muted mb-3">
          Use this when the school admin cannot use email recovery. The temporary password is generated in your
          browser, shown once, and never stored. Tell the admin to change it on next login.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-3 items-end">
          <FormField label="Admin email">
            <FieldInput
              type="email"
              value={pwEmail}
              onChange={(e) => {
                setPwEmail(e.target.value)
                setPwEmailError('')
              }}
            />
          </FormField>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (!EMAIL_PATTERN.test(pwEmail)) {
                setPwEmailError('Enter a valid email first.')
                return
              }
              setTempPassword(generatePassword())
            }}
          >
            Generate password
          </Button>
        </div>
        {pwEmailError && <ErrorBanner message={pwEmailError} />}
        {tempPassword && (
          <div className="mb-3">
            <p className="text-xs text-muted mb-1">Temporary password (shown once)</p>
            <code className="text-sm font-mono bg-bg px-3 py-1.5 rounded-lg border border-border inline-block">
              {tempPassword}
            </code>
          </div>
        )}
        {tempPassword && (
          <>
            <pre className="text-xs font-mono bg-bg border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap mb-3">
              {forgottenPasswordSql(pwEmail, tempPassword)}
            </pre>
            <div className="flex items-center gap-4">
              <CopyButton
                value={forgottenPasswordSql(pwEmail, tempPassword)}
                onCopy={() => log('runbook_forgotten_password_copied')}
              />
              {sqlEditorUrl && (
                <LinkButton href={sqlEditorUrl} target="_blank" rel="noreferrer">
                  Open SQL editor
                </LinkButton>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
