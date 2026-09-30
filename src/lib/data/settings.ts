import { supabase } from '@/lib/supabase'

export async function getPlatformSettings() {
  const { data, error } = await supabase.from('platform_settings').select('*').single()
  if (error) throw error
  return data
}
