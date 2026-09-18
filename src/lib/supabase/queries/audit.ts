import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  historialLegible, REFERENCIAS, type EntradaDeHistorial, type FilaDeAuditoria,
} from '@/lib/audit/historial'

/**
 * AUD-2 · El historial de UNA entidad.
 *
 * SIEMPRE se filtra por `entity_type` Y `entity_id`, nunca solo por el id: el
 * índice es `(entity_type, entity_id)`. Medido el 2026-09-18 sobre las 359 mil
 * filas de producción: con las dos columnas son **87 buffers**; con el id solo,
 * **2.357** — recorre la tabla entera para traer siete filas.
 *
 * Por eso NO hizo falta agregar un índice nuevo, que era la duda del plan:
 * habría costado en cada escritura para nada.
 */
export async function historialDeEntidad(
  entityType: string, entityId: string, limite = 50,
): Promise<EntradaDeHistorial[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, entity_type, created_at, old_data, new_data, actor_id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limite)
  if (error) throw error

  type Cruda = Omit<FilaDeAuditoria, 'actor_nombre'> & { actor_id: string | null }
  const filas = (data ?? []) as unknown as Cruda[]
  const [actores, referencias] = await Promise.all([
    nombresDeLosActores(filas.map(f => f.actor_id)),
    nombresDeLasReferencias(filas),
  ])
  return historialLegible(
    filas.map(f => ({ ...f, actor_nombre: f.actor_id ? actores.get(f.actor_id) ?? null : null })),
    referencias,
  )
}

/**
 * Los uuids que aparecen en el diff, cambiados por el nombre de lo que
 * apuntan.
 *
 * Sin esto el historial dice "Grupo #1a9acbce → #b89a3066", que no le contesta
 * a nadie de qué grupo a qué grupo — y esa era LA pregunta que pidió esta
 * pantalla (quién movió a Pamela Fonseca y a dónde).
 *
 * Va en UNA consulta por tabla y solo con los ids que de verdad salieron en
 * estas 50 filas.
 */
async function nombresDeLasReferencias(
  filas: readonly { old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null }[],
): Promise<Map<string, string>> {
  const porTabla = new Map<string, Set<string>>()
  for (const f of filas) {
    for (const datos of [f.old_data, f.new_data]) {
      for (const [campo, valor] of Object.entries(datos ?? {})) {
        const tabla = REFERENCIAS[campo]
        if (!tabla || typeof valor !== 'string') continue
        if (!porTabla.has(tabla)) porTabla.set(tabla, new Set())
        porTabla.get(tabla)!.add(valor)
      }
    }
  }
  const nombres = new Map<string, string>()
  if (!porTabla.size) return nombres

  const supabase = createAdminClient()
  const COLUMNAS: Record<string, string> = {
    study_groups: 'id, name', study_plans: 'id, name',
    members: 'id, first_name, last_name', areas: 'id, name',
  }
  await Promise.all([...porTabla].map(async ([tabla, ids]) => {
    // `tabla` sale de REFERENCIAS, que es una lista cerrada; el cast es para
    // que el tipo generado acepte el nombre como variable.
    const { data } = await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(tabla)
      .select(COLUMNAS[tabla]).in('id', [...ids])
    for (const r of (data ?? []) as unknown as Array<Record<string, string>>) {
      const nombre = tabla === 'members'
        ? `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()
        : r.name
      if (nombre) nombres.set(r.id, nombre)
    }
  }))
  return nombres
}

/**
 * De `auth.users.id` al nombre de la persona.
 *
 * PostgREST no puede cruzar a `auth`, así que el puente es
 * `members.auth_user_id` — mismo camino que usa
 * `resolverNombresDeQuienCancelo` en las becas. Una cuenta sin ficha queda sin
 * nombre y la pantalla la muestra como "el sistema".
 */
async function nombresDeLosActores(ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((v): v is string => !!v))]
  const nombres = new Map<string, string>()
  if (!unicos.length) return nombres
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('members').select('auth_user_id, first_name, last_name').in('auth_user_id', unicos)
  for (const m of (data ?? []) as Array<{ auth_user_id: string; first_name: string; last_name: string }>) {
    nombres.set(m.auth_user_id, `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim())
  }
  return nombres
}
