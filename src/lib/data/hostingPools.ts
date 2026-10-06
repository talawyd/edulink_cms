import { supabase } from '@/lib/supabase'

// TODO: drop these never-casts once database.types.ts is regenerated against
// migration 0009 (hosting_pools table, create_school_shared,
// create_school_dedicated, attach_dedicated_project) — none of it is in the
// checked-in types yet.

export type HostingPool = { id: string; label: string; kind: 'private' | 'public' }

export async function listHostingPools(): Promise<HostingPool[]> {
  const { data, error } = await (supabase.from('hosting_pools' as never) as any)
    .select('id, label, kind')
    .order('label')
  if (error) throw error
  return data as HostingPool[]
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
