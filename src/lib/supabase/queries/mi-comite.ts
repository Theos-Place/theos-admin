// SRV-4 · Los datos de la pantalla "Mi comité": la gente del comité y el
// estado de sus cuatro compromisos.
//
// Todo agregado: un comité tiene 30-80 personas y una consulta por fila serían
// 300 round trips. Son 6 consultas fijas, no importa el tamaño del comité.
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveAttendanceMemberIds } from '@/lib/supabase/queries/members-attendance'
import { esPuestoDeEncargado } from '@/lib/servers/encargados'
import type { Compromisos } from '@/lib/servers/compromisos'

export type FilaDeMiComite = {
  member_id: string
  nombre: string
  puestos: string[]
  encargado: boolean
} & Compromisos

/** Hace 12 meses, en fecha ISO. */
function haceUnAnio(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

/** `.in()` con listas largas arma URLs gigantes; se parte en tandas de 100. */
async function enTandas<T>(ids: string[], fn: (tanda: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 100) out.push(...await fn(ids.slice(i, i + 100)))
  return out
}

export async function getMiComite(committeeId: string): Promise<{ nombre: string; filas: FilaDeMiComite[] }> {
  const supabase = createAdminClient()

  const { data: area } = await supabase.from('areas').select('name').eq('id', committeeId).maybeSingle()
  const nombre = (area as { name: string } | null)?.name ?? ''

  // 1) Puestos del comité con su gente activa.
  const { data: puestosData, error: ePuestos } = await supabase
    .from('service_positions')
    .select('title, volunteers(member_id, status)')
    .eq('area_id', committeeId)
    .eq('is_active', true)
  if (ePuestos) throw ePuestos

  const puestosPorMiembro = new Map<string, string[]>()
  const encargados = new Set<string>()
  for (const p of (puestosData ?? []) as Array<Record<string, unknown>>) {
    const title = p.title as string
    for (const v of (p.volunteers ?? []) as Array<{ member_id: string; status: string }>) {
      if (v.status !== 'active') continue
      const ya = puestosPorMiembro.get(v.member_id)
      if (ya) ya.push(title); else puestosPorMiembro.set(v.member_id, [title])
      if (esPuestoDeEncargado(title)) encargados.add(v.member_id)
    }
  }
  const ids = [...puestosPorMiembro.keys()]
  if (!ids.length) return { nombre, filas: [] }

  const desde = haceUnAnio()

  const [personas, activos, matriculas, gruposDados, ultimos] = await Promise.all([
    // 2) Nombre y el flag de donante (criterio por trimestres, FIN-1).
    enTandas(ids, async tanda => {
      const { data, error } = await supabase
        .from('members').select('id, first_name, last_name, is_donor').in('id', tanda)
      if (error) throw error
      return (data ?? []) as Array<{ id: string; first_name: string; last_name: string; is_donor: boolean | null }>
    }),
    // 3) Asistencia activa: la MISMA función que usa la elegibilidad de estudios.
    getActiveAttendanceMemberIds(),
    // 4) Llevando un estudio en los últimos 12 meses. Cuenta la matrícula viva
    //    y también la que ya terminó dentro del año: el compromiso se cumplió.
    enTandas(ids, async tanda => {
      const { data, error } = await supabase
        .from('study_enrollments').select('member_id, status, enrolled_at, completed_at')
        .in('member_id', tanda)
        .or(`enrolled_at.gte.${desde},completed_at.gte.${desde}`)
      if (error) throw error
      return (data ?? []) as Array<{ member_id: string }>
    }),
    // 5) Dando un estudio: dirigente o co-dirigente de un grupo del último año.
    enTandas(ids, async tanda => {
      const { data, error } = await supabase
        .from('study_groups').select('leader_id, co_leader_id, starts_at, closed_at, status')
        .or(`leader_id.in.(${tanda.join(',')}),co_leader_id.in.(${tanda.join(',')})`)
        .or(`starts_at.gte.${desde},closed_at.gte.${desde},status.eq.active`)
      if (error) throw error
      return (data ?? []) as Array<{ leader_id: string | null; co_leader_id: string | null }>
    }),
    // 6) Último check-in de cada quien, en UNA consulta (DISTINCT ON en la BD).
    (async () => {
      const { data, error } = await supabase.rpc('ultimo_checkin_de_miembros', { p_member_ids: ids })
      if (error) throw error
      return (data ?? []) as Array<{ member_id: string; checked_in_at: string; event_title: string | null }>
    })(),
  ])

  const setActivos = new Set(activos)
  const setLlevando = new Set(matriculas.map(m => m.member_id))
  const setDando = new Set<string>()
  for (const g of gruposDados) {
    if (g.leader_id) setDando.add(g.leader_id)
    if (g.co_leader_id) setDando.add(g.co_leader_id)
  }
  const checkins = new Map(ultimos.map(u => [u.member_id, u]))

  const filas: FilaDeMiComite[] = personas.map(p => ({
    member_id: p.id,
    nombre: `${p.first_name} ${p.last_name}`.trim(),
    puestos: puestosPorMiembro.get(p.id) ?? [],
    encargado: encargados.has(p.id),
    asistencia: setActivos.has(p.id),
    llevandoEstudio: setLlevando.has(p.id),
    dandoEstudio: setDando.has(p.id),
    donante: p.is_donor === true,
    ultimoCheckin: checkins.get(p.id)?.checked_in_at?.slice(0, 10) ?? null,
  }))
  filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return { nombre, filas }
}
