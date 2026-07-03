import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { bloqueMilestones, MILESTONE_TO_TIPO, type BloqueMilestone } from '@/lib/studies/bloques'

// capacitacion_bloques y las columnas nuevas de folleto_requests no están en los
// tipos generados → cliente laxo.
function looseClient(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

export type DbBloque = {
  id: string
  nombre: string
  anio: number
  fecha_apertura: string
  fecha_cierre_matricula: string
  estado: 'activo' | 'archivado'
  preliminar_sent_at: string | null
  confirmacion_sent_at: string | null
  final_sent_at: string | null
  created_at: string
}

export type SedeCount = { sede: string; cantidad: number }

export async function getBloques(): Promise<DbBloque[]> {
  const supabase = looseClient()
  const { data, error } = await supabase
    .from('capacitacion_bloques')
    .select('id, nombre, anio, fecha_apertura, fecha_cierre_matricula, estado, preliminar_sent_at, confirmacion_sent_at, final_sent_at, created_at')
    .order('fecha_apertura', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbBloque[]
}

export async function createBloque(input: {
  nombre: string; anio: number; fecha_apertura: string; fecha_cierre_matricula: string
}): Promise<{ id: string }> {
  const supabase = looseClient()
  const { data, error } = await supabase.from('capacitacion_bloques').insert(input).select('id').single()
  if (error) throw error
  return data as { id: string }
}

export async function updateBloque(id: string, patch: Partial<{
  nombre: string; anio: number; fecha_apertura: string; fecha_cierre_matricula: string; estado: 'activo' | 'archivado'
}>): Promise<void> {
  const supabase = looseClient()
  const { error } = await supabase.from('capacitacion_bloques').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteBloque(id: string): Promise<void> {
  const supabase = looseClient()
  const { error } = await supabase.from('capacitacion_bloques').delete().eq('id', id)
  if (error) throw error
}

/** Conteo de folletos del bloque por sede (asociación por rango de fechas). */
export async function countBlockBySede(aperturaIso: string): Promise<SedeCount[]> {
  const supabase = looseClient()
  const { data, error } = await supabase.rpc('block_folletos_by_sede', { p_apertura: aperturaIso })
  if (error) { console.warn('countBlockBySede:', error.message); return [] }
  return ((data ?? []) as Array<{ sede: string; cantidad: number }>).map(r => ({ sede: r.sede, cantidad: Number(r.cantidad) }))
}

/** Total de matrículas asociadas a un bloque (para la regla de borrado). */
export async function countBlockEnrollments(aperturaIso: string): Promise<number> {
  const rows = await countBlockBySede(aperturaIso)
  return rows.reduce((s, r) => s + r.cantidad, 0)
}

export type MilestoneResult = {
  bloque_id: string
  bloque_nombre: string
  milestone: BloqueMilestone
  tipo: string
  fecha_apertura: string
  by_sede: SedeCount[]
  total: number
}

/** Cron liviano: para cada bloque activo, si HOY coincide con un hito aún no enviado,
 *  cuenta por sede, crea las folleto_requests de preapertura y marca el hito. Devuelve
 *  los hitos disparados (para notificar + correo). `todayIso` en zona CR. */
export async function processBloqueMilestones(todayIso: string): Promise<MilestoneResult[]> {
  const supabase = looseClient()
  const results: MilestoneResult[] = []
  const { data: bloques } = await supabase
    .from('capacitacion_bloques')
    .select('id, nombre, fecha_apertura, fecha_cierre_matricula, preliminar_sent_at, confirmacion_sent_at, final_sent_at')
    .eq('estado', 'activo')
  const list = (bloques ?? []) as Array<{
    id: string; nombre: string; fecha_apertura: string; fecha_cierre_matricula: string
    preliminar_sent_at: string | null; confirmacion_sent_at: string | null; final_sent_at: string | null
  }>

  const sentCol: Record<BloqueMilestone, 'preliminar_sent_at' | 'confirmacion_sent_at' | 'final_sent_at'> = {
    preliminar: 'preliminar_sent_at', confirmacion: 'confirmacion_sent_at', final: 'final_sent_at',
  }

  for (const b of list) {
    const hitos = bloqueMilestones(b.fecha_apertura, b.fecha_cierre_matricula)
    for (const m of ['preliminar', 'confirmacion', 'final'] as BloqueMilestone[]) {
      const alreadySent = b[sentCol[m]]
      if (alreadySent) continue
      if (hitos[m] !== todayIso) continue

      const bySede = await countBlockBySede(b.fecha_apertura)
      const total = bySede.reduce((s, r) => s + r.cantidad, 0)
      const tipo = MILESTONE_TO_TIPO[m]

      // Una folleto_request de preapertura por sede con cantidad > 0.
      const rows = bySede.filter(r => r.cantidad > 0).map(r => ({
        tipo,
        bloque_id: b.id,
        sede: r.sede,
        quantity: r.cantidad,
        close_date: todayIso,        // fecha del reporte
        available_at: b.fecha_apertura, // listos para la apertura
        status: 'creada',
      }))
      if (rows.length) await supabase.from('folleto_requests').insert(rows)

      // Marcar el hito como enviado (anti-duplicado del cron).
      await supabase.from('capacitacion_bloques').update({ [sentCol[m]]: new Date().toISOString() }).eq('id', b.id)

      results.push({
        bloque_id: b.id, bloque_nombre: b.nombre, milestone: m, tipo,
        fecha_apertura: b.fecha_apertura, by_sede: bySede, total,
      })
    }
  }
  return results
}
