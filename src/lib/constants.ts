export const CHECKLIST_STEPS = [
  { key: 'project_created', label: 'Project created' },
  { key: 'migrations_applied', label: 'Migrations applied' },
  { key: 'signups_off', label: 'Signups turned off' },
  { key: 'secret_key_named_default', label: 'Secret key named "default"' },
  { key: 'function_deployed', label: 'Function deployed' },
  { key: 'access_test_passed', label: 'Access test passed' },
  { key: 'school_settings_row', label: 'school_settings row inserted' },
  { key: 'licence_row_set', label: 'Licence row set' },
  { key: 'first_admin_created', label: 'First admin created' },
  { key: 'registered_in_tpic', label: 'Registered in TPIC' },
  { key: 'address_working', label: 'Address working' },
  { key: 'website_link_added', label: 'Website link added' },
  { key: 'handover_done', label: 'Handover done' },
] as const

export type ChecklistStepKey = (typeof CHECKLIST_STEPS)[number]['key']

export const PLATFORM_DOMAIN_FALLBACK = 'edulink.live'

export function schoolAddress(code: string, platformDomain: string) {
  return `${code}.${platformDomain}`
}

// The highest migration number applied in EduLink's database/pooled/supabase/migrations.
// Nothing ties these two repos together, so this has to be bumped by hand
// every time a migration ships there - that's what tpi_schema_version()
// (same repo) checks a project's own project against.
export const POOLED_SCHEMA_VERSION = 13

export function projectRefFromUrl(url: string): string | null {
  return url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/)?.[1] ?? null
}

export function schemaCatchUpCommands(projectRef: string) {
  return `supabase link --project-ref ${projectRef}\nsupabase db push --linked`
}

export function supabaseDashboardLinks(projectRef: string) {
  const base = `https://supabase.com/dashboard/project/${projectRef}`
  return {
    users: `${base}/auth/users`,
    sqlEditor: `${base}/sql/new`,
    apiKeys: `${base}/settings/api-keys`,
    functions: `${base}/functions`,
  }
}
