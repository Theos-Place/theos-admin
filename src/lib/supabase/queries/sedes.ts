import { createAdminClient } from '@/lib/supabase/admin'
import type { Sede } from '@/lib/sedes'

// NOTA: createAdminClient (service role) porque la app corre con mock auth.

const normName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

/** Crea una sede (zona) por nombre, evitando duplicados: si ya existe una con el
 *  mismo nombre normalizado (sin tildes/mayúsculas) devuelve ESA (marcándola como
 *  zona si no lo era). Genera un `code` único a partir del nombre. Devuelve el
 *  shape de dominio (id = code). Solo la llama el picker de zona de estudios, por
 *  eso lo creado/reusado queda con is_zone=true — pero NO is_active: activar una
 *  zona acá la metería en los pickers de sede de miembros/eventos. */
export async function createSede(name: string): Promise<Sede> {
  const supabase = createAdminClient()
  const clean = name.trim()
  if (!clean) throw new Error('El nombre de la zona no puede estar vacío')

  const { data: all, error: e1 } = await supabase
    .from('sedes').select('code, name, is_active, is_historical, is_zone')
  if (e1) throw e1
  const rows = (all ?? []) as Array<{ code: string; name: string; is_active: boolean; is_historical: boolean; is_zone: boolean }>

  // Dedup por nombre normalizado → reusar la existente (asegurando is_zone).
  const dup = rows.find(s => normName(s.name) === normName(clean))
  if (dup) {
    if (!dup.is_zone) {
      const { error: e2 } = await supabase.from('sedes').update({ is_zone: true }).eq('code', dup.code)
      if (e2) throw e2
    }
    return { id: dup.code, name: dup.name, is_active: !!dup.is_active, is_historical: !!dup.is_historical, is_zone: true }
  }

  // Code único a partir del nombre.
  const base = normName(clean).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'ZONA'
  const taken = new Set(rows.map(s => s.code))
  let code = base
  for (let i = 2; taken.has(code); i++) code = `${base}_${i}`

  const { data, error } = await supabase
    .from('sedes').insert({ code, name: clean, is_active: false, is_zone: true })
    .select('code, name, is_active, is_historical, is_zone').single()
  if (error) throw error
  const r = data as { code: string; name: string; is_active: boolean; is_historical: boolean; is_zone: boolean }
  return { id: r.code, name: r.name, is_active: !!r.is_active, is_historical: !!r.is_historical, is_zone: !!r.is_zone }
}

export async function getSedes(): Promise<Sede[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sedes')
    .select('id, code, name, is_active, is_historical, is_zone, day, time, location, age_group, waze_url, currency')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((s) => {
    const r = s as Record<string, unknown>
    return {
      id: r.code as string,
      sede_id: r.id as string,
      currency: (r.currency as string) ?? 'CRC',
      name: r.name as string,
      is_active: !!r.is_active,
      is_historical: !!r.is_historical,
      is_zone: !!r.is_zone,
      day: (r.day as string) ?? undefined,
      time: (r.time as string) ?? undefined,
      location: (r.location as string) ?? undefined,
      age_group: (r.age_group as string) ?? undefined,
      waze_url: (r.waze_url as string) ?? undefined,
    }
  })
}
