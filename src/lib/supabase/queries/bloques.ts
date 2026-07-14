import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { bloqueMilestones, MILESTONE_TO_TIPO, bloqueEstadoActual, addDays, type BloqueMilestone, type BloqueEstado } from '@/lib/studies/bloques'

/** Hoy en zona America/Costa_Rica (YYYY-MM-DD). */
function crToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date())
}


export type DbBloque = {
  id: string
  nombre: string
  anio: number
  fecha_apertura: string
  fecha_cierre_matricula: string
  estado: BloqueEstado
  preliminar_sent_at: string | null
  confirmacion_sent_at: string | null
  final_sent_at: string | null
  created_at: string
}

export type SedeCount = { sede: string; cantidad: number }

export async function getBloques(): Promise<DbBloque[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('capacitacion_bloques')
    .select('id, nombre, anio, fecha_apertura, fecha_cierre_matricula, estado, preliminar_sent_at, confirmacion_sent_at, final_sent_at, created_at')
    .order('fecha_apertura', { ascending: false })
  if (error) throw error
  const today = crToday()
  // Estado SIEMPRE derivado de fechas (autoritativo); ignora el valor almacenado.
  return ((data ?? []) as DbBloque[]).map(b => ({
    ...b, estado: bloqueEstadoActual(b.fecha_apertura, b.fecha_cierre_matricula, today),
  }))
}

export async function createBloque(input: {
  nombre: string; anio: number; fecha_apertura: string; fecha_cierre_matricula: string
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const estado = bloqueEstadoActual(input.fecha_apertura, input.fecha_cierre_matricula, crToday())
  const { data, error } = await supabase.from('capacitacion_bloques').insert({ ...input, estado }).select('id').single()
  if (error) throw error
  return data as { id: string }
}

// El estado NO se setea a mano — se deriva de las fechas. El patch solo permite
// nombre/año/fechas; el estado se recalcula acá según las fechas resultantes.
export async function updateBloque(id: string, patch: Partial<{
  nombre: string; anio: number; fecha_apertura: string; fecha_cierre_matricula: string
}>): Promise<void> {
  const supabase = createAdminClient()
  const row: Partial<{
    nombre: string; anio: number; fecha_apertura: string; fecha_cierre_matricula: string
    estado: string; updated_at: string
  }> = { ...patch, updated_at: new Date().toISOString() }
  if (patch.fecha_apertura && patch.fecha_cierre_matricula) {
    row.estado = bloqueEstadoActual(patch.fecha_apertura, patch.fecha_cierre_matricula, crToday())
  }
  const { error } = await supabase.from('capacitacion_bloques').update(row).eq('id', id)
  if (error) throw error
}

export async function deleteBloque(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('capacitacion_bloques').delete().eq('id', id)
  if (error) throw error
}

/** Conteo de folletos del bloque por sede (asociación por rango de fechas).
 *  Lanza si el RPC falla: un [] silencioso haría que el cron marque hitos como
 *  enviados sin haber creado ningún reporte. */
export async function countBlockBySede(aperturaIso: string): Promise<SedeCount[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('block_folletos_by_sede', { p_apertura: aperturaIso })
  if (error) throw new Error(`countBlockBySede: ${error.message}`)
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
  const supabase = createAdminClient()
  const results: MilestoneResult[] = []
  // Todos los bloques: el match de fecha del hito + el dedup (_sent_at) controlan
  // qué dispara. (El estado es derivado; ya no se filtra por él.)
  const { data: bloques } = await supabase
    .from('capacitacion_bloques')
    .select('id, nombre, fecha_apertura, fecha_cierre_matricula, estado, preliminar_sent_at, confirmacion_sent_at, final_sent_at')
  const list = (bloques ?? []) as Array<{
    id: string; nombre: string; fecha_apertura: string; fecha_cierre_matricula: string; estado: string
    preliminar_sent_at: string | null; confirmacion_sent_at: string | null; final_sent_at: string | null
  }>

  // Recalcular el estado almacenado (cache) a diario según fechas.
  for (const b of list) {
    const derived = bloqueEstadoActual(b.fecha_apertura, b.fecha_cierre_matricula, todayIso)
    if (derived !== b.estado) {
      await supabase.from('capacitacion_bloques').update({ estado: derived }).eq('id', b.id)
    }
  }

  const sentCol: Record<BloqueMilestone, 'preliminar_sent_at' | 'confirmacion_sent_at' | 'final_sent_at'> = {
    preliminar: 'preliminar_sent_at', confirmacion: 'confirmacion_sent_at', final: 'final_sent_at',
  }

  // Ventana de catch-up: si el cron no corrió el día exacto del hito (deploy
  // caído, edge function con error), el hito se dispara en los días siguientes
  // en vez de perderse para siempre. Acotada para que bloques históricos que
  // nunca dispararon no generen reportes viejos de golpe.
  const CATCHUP_DAYS = 7

  for (const b of list) {
    const hitos = bloqueMilestones(b.fecha_apertura, b.fecha_cierre_matricula)
    for (const m of ['preliminar', 'confirmacion', 'final'] as BloqueMilestone[]) {
      const alreadySent = b[sentCol[m]]
      if (alreadySent) continue
      if (todayIso < hitos[m] || todayIso > addDays(hitos[m], CATCHUP_DAYS)) continue

      // Si el conteo o el insert fallan, NO se marca el hito: el próximo cron
      // dentro de la ventana lo reintenta. Un fallo en un bloque no detiene
      // los demás.
      try {
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
        if (rows.length) {
          const { error: insErr } = await supabase.from('folleto_requests').insert(rows)
          if (insErr) throw insErr
        }

        // Marcar el hito como enviado (anti-duplicado del cron) — solo tras
        // crear los reportes con éxito.
        const { error: markErr } = await supabase
          .from('capacitacion_bloques')
          .update({ [sentCol[m]]: new Date().toISOString() } as Record<typeof sentCol[BloqueMilestone], string>)
          .eq('id', b.id)
        if (markErr) throw markErr

        results.push({
          bloque_id: b.id, bloque_nombre: b.nombre, milestone: m, tipo,
          fecha_apertura: b.fecha_apertura, by_sede: bySede, total,
        })
      } catch (e) {
        console.error(`processBloqueMilestones ${b.nombre}/${m}:`, e)
      }
    }
  }
  return results
}
