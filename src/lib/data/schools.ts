import { supabase } from '@/lib/supabase'
import type { Json, Tables } from '@/types/database.types'

export type SchoolListRow = Tables<'schools'> & {
  subscriptions: Pick<Tables<'subscriptions'>, 'license_expires_on' | 'status'> | null
  school_domains: Pick<Tables<'school_domains'>, 'hostname' | 'is_primary'>[]
}

export async function listSchoolOptions(): Promise<Pick<Tables<'schools'>, 'id' | 'name' | 'code'>[]> {
  const { data, error } = await supabase.from('schools').select('id, name, code').order('name')
  if (error) throw error
  return data
}

export async function listSchools(): Promise<SchoolListRow[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('*, subscriptions(license_expires_on, status), school_domains(hostname, is_primary)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as SchoolListRow[]
}

export type SchoolDetail = {
  school: Tables<'schools'>
  project: Tables<'school_projects'> | null
  domains: Tables<'school_domains'>[]
  subscription: Tables<'subscriptions'> | null
  checklist: Tables<'school_checklist'>[]
}

export async function getSchool(id: string): Promise<SchoolDetail> {
  const [school, project, domains, subscription, checklist] = await Promise.all([
    supabase.from('schools').select('*').eq('id', id).single(),
    supabase.from('school_projects').select('*').eq('school_id', id).maybeSingle(),
    supabase.from('school_domains').select('*').eq('school_id', id),
    supabase.from('subscriptions').select('*').eq('school_id', id).maybeSingle(),
    supabase.from('school_checklist').select('*').eq('school_id', id),
  ])
  if (school.error) throw school.error
  if (project.error) throw project.error
  if (domains.error) throw domains.error
  if (subscription.error) throw subscription.error
  if (checklist.error) throw checklist.error
  return {
    school: school.data,
    project: project.data,
    domains: domains.data ?? [],
    subscription: subscription.data,
    checklist: checklist.data ?? [],
  }
}

export type CreateSchoolInput = {
  code: string
  name: string
  contactName: string
  contactEmail: string
  contactPhone: string
  supabaseUrl: string
  publishableKey: string
  region: string
  plan: string
  billingCycle: string
  price: number
}

export type CreateSchoolResult = { school_id: string; hostname: string; code: string; license_expires_on: string }

export async function createSchool(input: CreateSchoolInput): Promise<CreateSchoolResult> {
  const { data, error } = await supabase.rpc('create_school', {
    p_code: input.code,
    p_name: input.name,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone,
    p_supabase_url: input.supabaseUrl,
    p_publishable_key: input.publishableKey,
    p_region: input.region,
    p_plan: input.plan,
    p_billing_cycle: input.billingCycle,
    p_price: input.price,
  })
  if (error) throw error
  return data as unknown as CreateSchoolResult
}

export async function updateSchoolProject(
  schoolId: string,
  supabaseUrl: string,
  publishableKey: string,
  region: string,
) {
  const { error } = await supabase.rpc('update_school_project', {
    p_school_id: schoolId,
    p_supabase_url: supabaseUrl,
    p_publishable_key: publishableKey,
    p_region: region,
  })
  if (error) throw error
}

export async function setSchoolStatus(schoolId: string, status: string, reason: string) {
  const { error } = await supabase.rpc('set_school_status', {
    p_school_id: schoolId,
    p_status: status,
    p_reason: reason,
  })
  if (error) throw error
}

// TODO: drop this cast once database.types.ts is regenerated against
// migration 0007 — delete_school isn't in the checked-in types yet.
export async function deleteSchool(schoolId: string, confirmCode: string) {
  const { error } = await supabase.rpc(
    'delete_school' as never,
    { p_school_id: schoolId, p_confirm_code: confirmCode } as never,
  )
  if (error) throw error
}

export type ResolvedSchool = {
  anon_key: string
  school_code: string
  school_name: string
  status: string
  supabase_url: string
}

export async function testAddress(hostname: string): Promise<ResolvedSchool | null> {
  const { data, error } = await supabase.rpc('resolve_school_by_hostname', { p_hostname: hostname })
  if (error) throw error
  return data?.[0] ?? null
}

export async function setChecklistStep(schoolId: string, stepKey: string, note?: string) {
  const { error } = await supabase.from('school_checklist').upsert({ school_id: schoolId, step_key: stepKey, note })
  if (error) throw error
}

export async function clearChecklistStep(schoolId: string, stepKey: string) {
  const { error } = await supabase
    .from('school_checklist')
    .delete()
    .eq('school_id', schoolId)
    .eq('step_key', stepKey)
  if (error) throw error
}

export async function logOperation(action: string, schoolId?: string, details?: Json) {
  const { error } = await supabase.rpc('log_operation', {
    p_action: action,
    p_school_id: schoolId,
    p_details: details ?? {},
  })
  if (error) throw error
}

export async function fetchSchoolActivity(schoolId: string) {
  const { data, error } = await supabase
    .from('operations_log')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
