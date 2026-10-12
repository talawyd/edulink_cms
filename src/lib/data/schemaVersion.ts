import { createClient } from '@supabase/supabase-js'

// tpi_schema_version() lives in the project itself (EduLink pooled schema),
// same anon-callable pattern as tpi_role_counts(): only that project's
// publishable key, no session.
export async function getRemoteSchemaVersion(supabaseUrl: string, anonKey: string): Promise<number> {
  const pool = createClient(supabaseUrl, anonKey)
  const { data, error } = await pool.rpc('tpi_schema_version')
  if (error) throw error
  return data ?? 0
}
