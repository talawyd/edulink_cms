import { supabase } from '@/lib/supabase'

export type StaffRow = {
  user_id: string
  email: string
  full_name: string
  role: string
  active: boolean
  last_sign_in_at: string | null
}

export async function listStaff(): Promise<StaffRow[]> {
  const { data, error } = await supabase.rpc('list_tpi_staff')
  if (error) throw error
  return data
}

export async function addStaff(email: string, fullName: string, role: string) {
  const { error } = await supabase.rpc('add_tpi_staff', { p_email: email, p_full_name: fullName, p_role: role })
  if (error) throw error
}

export async function setStaffActive(userId: string, active: boolean) {
  const { error } = await supabase.rpc('set_tpi_staff_active', { p_user_id: userId, p_active: active })
  if (error) throw error
}
