import { supabase } from '@/lib/supabase'

export async function getPlatformSettings() {
  const { data, error } = await supabase.from('platform_settings').select('*').single()
  if (error) throw error
  return data
}

export async function updatePlatformSettings(fields: { default_grace_days?: number; require_mfa?: boolean }) {
  const { error } = await supabase.from('platform_settings').update(fields).eq('id', true)
  if (error) throw error
}
