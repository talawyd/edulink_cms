import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export async function fetchActivityPage(
  page: number,
  pageSize: number,
  filters: { schoolId?: string; action?: string },
): Promise<{ rows: Tables<'operations_log'>[]; count: number }> {
  let query = supabase
    .from('operations_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.schoolId) query = query.eq('school_id', filters.schoolId)
  if (filters.action) query = query.ilike('action', `%${filters.action}%`)

  const from = page * pageSize
  const { data, error, count } = await query.range(from, from + pageSize - 1)
  if (error) throw error
  return { rows: data, count: count ?? 0 }
}
