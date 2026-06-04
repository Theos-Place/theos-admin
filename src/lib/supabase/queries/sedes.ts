import { createAdminClient } from '@/lib/supabase/admin'
import type { Sede } from '@/lib/sedes'

// NOTA: createAdminClient (service role) porque la app corre con mock auth.

export async function getSedes(): Promise<Sede[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sedes')
    .select('code, name, is_active, is_historical, day, time, location, age_group, waze_url')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((s) => {
    const r = s as Record<string, unknown>
    return {
      id: r.code as string,
      name: r.name as string,
      is_active: !!r.is_active,
      is_historical: !!r.is_historical,
      day: (r.day as string) ?? undefined,
      time: (r.time as string) ?? undefined,
      location: (r.location as string) ?? undefined,
      age_group: (r.age_group as string) ?? undefined,
      waze_url: (r.waze_url as string) ?? undefined,
    }
  })
}
