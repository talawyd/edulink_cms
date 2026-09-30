import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type DueRow = {
  school_id: string
  code: string
  name: string
  contact_email: string
  license_expires_on: string
  days_left: number
  state: string
  last_reminder_sent_at: string | null
}

export async function subscriptionsDue(withinDays: number): Promise<DueRow[]> {
  const { data, error } = await supabase.rpc('subscriptions_due', { p_within_days: withinDays })
  if (error) throw error
  return data
}

export async function updateSubscription(schoolId: string, plan: string, billingCycle: string, price: number) {
  const { error } = await supabase
    .from('subscriptions')
    .update({ plan, billing_cycle: billingCycle, price_amount: price })
    .eq('school_id', schoolId)
  if (error) throw error
}

export async function createLicenseSecret(schoolId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_license_secret', { p_school_id: schoolId })
  if (error) throw error
  return data
}

export async function rotateLicenseSecret(schoolId: string): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_license_secret', { p_school_id: schoolId })
  if (error) throw error
  return data
}

export type GenerateKeyResult = { key: string; expires_on: string; key_id: number }

export async function generateLicenseKey(schoolId: string): Promise<GenerateKeyResult> {
  const { data, error } = await supabase.rpc('generate_license_key', { p_school_id: schoolId })
  if (error) throw error
  return data as unknown as GenerateKeyResult
}

export async function markLicenseKeySent(keyRowId: string, sentTo: string) {
  const { error } = await supabase.rpc('mark_license_key_sent', { p_key_row: keyRowId, p_sent_to: sentTo })
  if (error) throw error
}

export async function listLicenseKeys(schoolId: string): Promise<Tables<'license_keys'>[]> {
  const { data, error } = await supabase
    .from('license_keys')
    .select('*')
    .eq('school_id', schoolId)
    .order('issued_at', { ascending: false })
  if (error) throw error
  return data
}
