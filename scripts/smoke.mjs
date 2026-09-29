// Usage: node scripts/smoke.mjs <SMOKE_EMAIL> <SMOKE_PASSWORD>
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env (not secret).
// Email/password must be passed as argv, never read from a file.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function loadEnv() {
  const text = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
  return env
}

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error('Usage: node scripts/smoke.mjs <SMOKE_EMAIL> <SMOKE_PASSWORD>')
  process.exit(1)
}

const env = loadEnv()
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)

const rows = []

function record(call, res) {
  const { data, error, count } = res ?? {}
  const rowCount = count != null ? count : Array.isArray(data) ? data.length : data == null ? 0 : 1
  rows.push({
    call,
    rows: error ? '-' : rowCount,
    error: error ? `${error.code ?? ''} ${error.message}`.trim() : '',
  })
}

// Unauthenticated call first.
record(
  'resolve_school_by_hostname(nosuch.edulink.live)',
  await supabase.rpc('resolve_school_by_hostname', { p_hostname: 'nosuch.edulink.live' }),
)

const signIn = await supabase.auth.signInWithPassword({ email, password })
if (signIn.error) {
  record('auth.signInWithPassword', signIn)
} else {
  record('platform_settings', await supabase.from('platform_settings').select('*'))
  record('schools (count)', await supabase.from('schools').select('id', { count: 'exact', head: true }))
  record('list_tpi_staff()', await supabase.rpc('list_tpi_staff'))
  record('subscriptions_due(60)', await supabase.rpc('subscriptions_due', { p_within_days: 60 }))
  await supabase.auth.signOut()
}

console.table(rows)
