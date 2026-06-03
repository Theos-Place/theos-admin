import { createClient } from '@/lib/supabase/server'

// ── Tipos ──────────────────────────────────────────────────

export type Member = {
  id: string
  cedula: string | null
  first_name: string
  last_name: string
  birth_date: string | null
  gender: 'M' | 'F' | 'otro' | null
  marital_status: string | null
  phone_whatsapp: string | null
  email: string | null
  province: string | null
  canton: string | null
  district: string | null
  address: string | null
  occupation: string | null
  workplace: string | null
  allergies: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  photo_url: string | null
  is_donor: boolean
  is_active: boolean
  deactivation_reason: string | null
  deactivated_at: string | null
  created_at: string
  updated_at: string
}

export type MemberFilters = {
  search?: string
  province?: string
  is_active?: boolean
  is_donor?: boolean
  gender?: string
  page?: number
  pageSize?: number
}

// ── Queries ────────────────────────────────────────────────

export async function getMembers(filters: MemberFilters = {}) {
  const supabase = await createClient()
  const {
    search,
    province,
    is_active = true,
    is_donor,
    gender,
    page = 1,
    pageSize = 50,
  } = filters

  let query = supabase
    .from('members')
    .select('*', { count: 'exact' })
    .eq('is_active', is_active)
    .order('last_name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,cedula.ilike.%${search}%,email.ilike.%${search}%`
    )
  }
  if (province) query = query.eq('province', province)
  if (is_donor !== undefined) query = query.eq('is_donor', is_donor)
  if (gender) query = query.eq('gender', gender)

  const { data, error, count } = await query

  if (error) throw error
  return { members: data as Member[], total: count ?? 0 }
}

export async function getMemberById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Member
}

export async function createMember(member: Omit<Member, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .insert(member)
    .select()
    .single()

  if (error) throw error
  return data as Member
}

export async function updateMember(id: string, updates: Partial<Member>) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Member
}

export async function deactivateMember(
  id: string,
  reason: string,
  deactivated_by: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .update({
      is_active: false,
      deactivation_reason: reason,
      deactivated_at: new Date().toISOString(),
      deactivated_by,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Member
}