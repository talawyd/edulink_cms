import { supabase } from '@/lib/supabase'

// TODO: drop these never-casts once database.types.ts is regenerated against
// migration 0009 (create_school_shared, create_school_dedicated,
// attach_dedicated_project) — not in the checked-in types yet. hosting_pools
// and register_hosting_pool are now typed for real, below.

export type HostingPool = { id: string; label: string; kind: 'private' | 'public'; supabase_url: string }

export async function listHostingPools(): Promise<HostingPool[]> {
  const { data, error } = await supabase.from('hosting_pools').select('id, label, kind, supabase_url').order('label')
  if (error) throw error
  return data as HostingPool[]
}

export async function canManageHostingPools() {
  const { data, error } = await supabase.rpc('has_tpi_role', { p_roles: ['owner', 'engineer'] })
  if (error) throw error
  return data
}

export async function registerHostingPool(label: string, kind: string, url: string, key: string) {
  const { error } = await supabase.rpc('register_hosting_pool', { p_label: label, p_kind: kind, p_url: url, p_key: key })
  if (error) throw error
}

export type CreateSchoolSharedInput = {
  code: string
  name: string
  contactName: string
  contactEmail: string
  contactPhone: string
  poolLabel: string
  plan: string
  billingCycle: string
  price: number
}

export type CreateSchoolSharedResult = {
  school_id: string
  hostname: string
  code: string
  pool: string
  license_expires_on: string
}

export async function createSchoolShared(input: CreateSchoolSharedInput): Promise<CreateSchoolSharedResult> {
  const { data, error } = await supabase.rpc(
    'create_school_shared' as never,
    {
      p_code: input.code,
      p_name: input.name,
      p_contact_name: input.contactName,
      p_contact_email: input.contactEmail,
      p_contact_phone: input.contactPhone,
      p_pool_label: input.poolLabel,
      p_plan: input.plan,
      p_billing_cycle: input.billingCycle,
      p_price: input.price,
    } as never,
  )
  if (error) throw error
  return data as unknown as CreateSchoolSharedResult
}

export type CreateSchoolDedicatedInput = {
  code: string
  name: string
  contactName: string
  contactEmail: string
  contactPhone: string
  schoolType: string
  region: string
  plan: string
  billingCycle: string
  price: number
}

export type CreateSchoolDedicatedResult = {
  school_id: string
  hostname: string
  code: string
  awaiting_connection: boolean
}

export async function createSchoolDedicated(
  input: CreateSchoolDedicatedInput,
): Promise<CreateSchoolDedicatedResult> {
  const { data, error } = await supabase.rpc(
    'create_school_dedicated' as never,
    {
      p_code: input.code,
      p_name: input.name,
      p_contact_name: input.contactName,
      p_contact_email: input.contactEmail,
      p_contact_phone: input.contactPhone,
      p_school_type: input.schoolType,
      p_region: input.region,
      p_plan: input.plan,
      p_billing_cycle: input.billingCycle,
      p_price: input.price,
    } as never,
  )
  if (error) throw error
  return data as unknown as CreateSchoolDedicatedResult
}

export async function attachDedicatedProject(
  schoolId: string,
  supabaseUrl: string,
  publishableKey: string,
  region: string,
) {
  const { error } = await supabase.rpc(
    'attach_dedicated_project' as never,
    { p_school_id: schoolId, p_url: supabaseUrl, p_key: publishableKey, p_region: region } as never,
  )
  if (error) throw error
}
