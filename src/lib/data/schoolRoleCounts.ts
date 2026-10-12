import { createClient } from '@supabase/supabase-js'

export type SchoolRoleCounts = { students: number; teachers: number; parents: number; admins: number }

// tpi_role_counts() lives in the school's own pool project (EduLink), not
// TPIC's database - it's the one function there grantable to anon, built
// specifically to be called with nothing but that project's publishable
// key, no session. p_school_id must go in the POST body under that exact
// name, matching the function's own parameter name, or PostgREST refuses
// the call; supabase-js's rpc() already does this correctly.
export async function getSchoolRoleCounts(
  supabaseUrl: string,
  anonKey: string,
  schoolId: string,
): Promise<SchoolRoleCounts> {
  const pool = createClient(supabaseUrl, anonKey)
  const { data, error } = await pool.rpc('tpi_role_counts', { p_school_id: schoolId })
  if (error) throw error
  const row = data?.[0] ?? {}
  return {
    students: row.students ?? 0,
    teachers: row.teachers ?? 0,
    parents: row.parents ?? 0,
    admins: row.admins ?? 0,
  }
}
