// SRV-4 · Los datos de la pantalla "Mi comité": la gente del comité y el
// estado de sus cuatro compromisos.
//
// Todo agregado: un comité tiene 30-80 personas y una consulta por fila serían
// 300 round trips. Son 6 consultas fijas, no importa el tamaño del comité.
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveAttendanceMemberIds } from '@/lib/supabase/queries/members-attendance'
import { esPuestoDeEncargado } from '@/lib/servers/encargados'
import { grupoEnMarcha, matriculaVigente, type EstudioDeLaPersona } from '@/lib/studies/estudio-actual'
import type { Compromisos } from '@/lib/servers/compromisos'

/** PostgREST devuelve un embed to-one como objeto o como array según el caso. */
function uno<T>(v: unknown): T | null {
  return (Array.isArray(v) ? (v[0] ?? null) : (v ?? null)) as T | null
}

type NombreEmbed = { name: string | null } | Array<{ name: string | null }> | null

type MatriculaCruda = {
  member_id: string
  status: string | null
  enrolled_at: string | null
  completed_at: string | null
  plan: NombreEmbed
  grupo: { name: string | null; status: string | null; closed_at: string | null; plan: NombreEmbed } | Array<{ name: string | null; status: string | null; closed_at: string | null; plan: NombreEmbed }> | null
}

type GrupoCrudo = {
  leader_id: string | null
  co_leader_id: string | null
  status: string | null
  name: string | null
  closed_at: string | null
  starts_at: string | null
  plan: NombreEmbed
}

/** El nombre que se muestra: el del PLAN ("Nivel 2"), que es como la gente
 *  llama al estudio. El del grupo trae horario y sede ("Nivel 2 Cartago 7pm") y
 *  no cabe en una celda. */
function nombreDelEstudio(plan: NombreEmbed, nombreDelGrupo?: string | null): string {
  return uno<{ name: string | null }>(plan)?.name ?? nombreDelGrupo ?? 'Estudio'
}

export type FilaDeMiComite = {
  member_id: string
  nombre: string
  puestos: string[]
  encargado: boolean
  /** Comités donde tiene un puesto activo DENTRO del alcance consultado. Para
   *  REP-7: alguien puede servir en varios y hay que des-duplicarlo. */
  comites: string[]
  /** Contacto. Solo viaja para el EXPORT, no se dibuja en la tabla: la lista
   *  existe para llamar a quien tiene algo pendiente. No abre nada nuevo — el
   *  mismo encargado ya los exporta desde /servidores con SERVER_COLUMNS. */
  telefono: string | null
  email: string | null
  cumpleanos: string | null
  /** SRV-7 · Qué estudio lleva, cuál da, o cuál fue el último. */
  estudio: EstudioDeLaPersona
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

/**
 * REP-7 · Lo mismo pero para VARIOS comités a la vez.
 *
 * La misma consulta que "Mi comité", que por eso da los mismos números: si el
 * reporte global y la pantalla del encargado difirieran para un mismo comité,
 * sería un bug. `getMiComite` es el caso de uno.
 *
 * Sigue sin ser una consulta por persona: son ~6 por cada tanda de 100, así que
 * el alcance global (≈1.000 servidores) son unas 30 y no mil.
 */
export async function getCompromisosDeComites(
  committeeIds: readonly string[],
): Promise<FilaDeMiComite[]> {
  const supabase = createAdminClient()
  if (!committeeIds.length) return []

  // 1) Puestos de los comités con su gente activa.
  const { data: puestosData, error: ePuestos } = await supabase
    .from('service_positions')
    .select('area_id, title, volunteers(member_id, status)')
    .in('area_id', committeeIds as string[])
    .eq('is_active', true)
  if (ePuestos) throw ePuestos

  const puestosPorMiembro = new Map<string, string[]>()
  const comitesPorMiembro = new Map<string, Set<string>>()
  const encargados = new Set<string>()
  for (const p of (puestosData ?? []) as Array<Record<string, unknown>>) {
    const title = p.title as string
    const areaId = p.area_id as string
    for (const v of (p.volunteers ?? []) as Array<{ member_id: string; status: string }>) {
      if (v.status !== 'active') continue
      const ya = puestosPorMiembro.get(v.member_id)
      if (ya) ya.push(title); else puestosPorMiembro.set(v.member_id, [title])
      const cs = comitesPorMiembro.get(v.member_id)
      if (cs) cs.add(areaId); else comitesPorMiembro.set(v.member_id, new Set([areaId]))
      if (esPuestoDeEncargado(title)) encargados.add(v.member_id)
    }
  }
  const ids = [...puestosPorMiembro.keys()]
  if (!ids.length) return []

  const desde = haceUnAnio()

  const [personas, activos, matriculas, gruposDados, ultimos] = await Promise.all([
    // 2) Nombre y el flag de donante (criterio por trimestres, FIN-1).
    enTandas(ids, async tanda => {
      const { data, error } = await supabase
        .from('members').select('id, first_name, last_name, is_donor, phone, email, birth_date').in('id', tanda)
      if (error) throw error
      return (data ?? []) as Array<{
        id: string; first_name: string; last_name: string; is_donor: boolean | null
        phone: string | null; email: string | null; birth_date: string | null
      }>
    }),
    // 3) Asistencia activa: la MISMA función que usa la elegibilidad de estudios.
    getActiveAttendanceMemberIds(),
    // 4) Matrículas. Se traen TODAS las de la persona y no solo las del último
    //    año: SRV-7 pide mostrar el último estudio de quien hoy no lleva
    //    ninguno, y ese puede ser de hace tres años. Sigue siendo una consulta
    //    por tanda de 100, no una por persona.
    enTandas(ids, async tanda => {
      const { data, error } = await supabase
        .from('study_enrollments')
        .select('member_id, status, enrolled_at, completed_at, plan:study_plans(name), grupo:study_groups!study_enrollments_group_id_fkey(name, status, closed_at, plan:study_plans(name))')
        .in('member_id', tanda)
      if (error) throw error
      return (data ?? []) as unknown as Array<MatriculaCruda>
    }),
    // 5) Dando un estudio: dirigente o co-dirigente de un grupo del último año.
    enTandas(ids, async tanda => {
      const { data, error } = await supabase
        .from('study_groups')
        .select('leader_id, co_leader_id, starts_at, closed_at, status, name, plan:study_plans(name)')
        .or(`leader_id.in.(${tanda.join(',')}),co_leader_id.in.(${tanda.join(',')})`)
      if (error) throw error
      return (data ?? []) as unknown as Array<GrupoCrudo>
    }),
    // 6) Último check-in de cada quien, en UNA consulta (DISTINCT ON en la BD).
    (async () => {
      const { data, error } = await supabase.rpc('ultimo_checkin_de_miembros', { p_member_ids: ids })
      if (error) throw error
      return (data ?? []) as Array<{ member_id: string; checked_in_at: string; event_title: string | null }>
    })(),
  ])

  const setActivos = new Set(activos)
  const checkins = new Map(ultimos.map(u => [u.member_id, u]))

  // SRV-7 · Qué estudio lleva o dio cada quien. Lo que manda para "ahora" es el
  // estado del GRUPO y no el de la matrícula (ver estudio-actual.ts).
  const estudios = new Map<string, EstudioDeLaPersona>()
  const deLaPersona = (id: string): EstudioDeLaPersona => {
    const ya = estudios.get(id)
    if (ya) return ya
    const nuevo: EstudioDeLaPersona = { llevando: [], dando: [], ultimo: null }
    estudios.set(id, nuevo)
    return nuevo
  }

  // OJO con la diferencia, que es fácil de perder: el COMPROMISO (el ✓/✗) sigue
  // siendo "llevó o dio algo en los últimos 12 meses", como antes de SRV-7. El
  // NOMBRE que se muestra es solo del estudio que está pasando AHORA. Mezclarlos
  // habría marcado en rojo a quien terminó su estudio hace cuatro meses.
  const setLlevando = new Set<string>()
  for (const m of matriculas) {
    const grupo = uno<{ name: string | null; status: string | null; closed_at: string | null; plan: NombreEmbed }>(m.grupo)
    const nombre = nombreDelEstudio(m.plan ?? grupo?.plan ?? null, grupo?.name)
    const e = deLaPersona(m.member_id)
    const fecha = grupo?.closed_at?.slice(0, 10) ?? m.completed_at?.slice(0, 10) ?? m.enrolled_at?.slice(0, 10) ?? null

    if (grupoEnMarcha(grupo?.status) && matriculaVigente(m.status)) {
      if (!e.llevando.includes(nombre)) e.llevando.push(nombre)
      setLlevando.add(m.member_id)
      continue
    }
    // Compromiso: una matrícula del último año cuenta aunque ya haya terminado.
    if (fecha && fecha >= desde) setLlevando.add(m.member_id)
    // Candidato a "último": el que terminó más recientemente. La fecha buena es
    // el cierre del grupo; si no hay, la de la matrícula.
    if (!e.ultimo || (fecha ?? '') > (e.ultimo.fecha ?? '')) e.ultimo = { nombre, fecha }
  }

  const setDando = new Set<string>()
  for (const g of gruposDados) {
    for (const id of [g.leader_id, g.co_leader_id]) {
      if (!id || !puestosPorMiembro.has(id)) continue
      const enMarcha = grupoEnMarcha(g.status)
      const reciente = (g.starts_at?.slice(0, 10) ?? '') >= desde || (g.closed_at?.slice(0, 10) ?? '') >= desde
      if (!enMarcha && !reciente) continue
      setDando.add(id)
      if (!enMarcha) continue
      const nombre = nombreDelEstudio(g.plan, g.name)
      const e = deLaPersona(id)
      if (!e.dando.includes(nombre)) e.dando.push(nombre)
    }
  }

  const filas: FilaDeMiComite[] = personas.map(p => ({
    member_id: p.id,
    nombre: `${p.first_name} ${p.last_name}`.trim(),
    puestos: puestosPorMiembro.get(p.id) ?? [],
    encargado: encargados.has(p.id),
    comites: [...(comitesPorMiembro.get(p.id) ?? [])],
    telefono: p.phone ?? null,
    email: p.email ?? null,
    cumpleanos: p.birth_date ?? null,
    asistencia: setActivos.has(p.id),
    llevandoEstudio: setLlevando.has(p.id),
    dandoEstudio: setDando.has(p.id),
    estudio: estudios.get(p.id) ?? { llevando: [], dando: [], ultimo: null },
    donante: p.is_donor === true,
    ultimoCheckin: checkins.get(p.id)?.checked_in_at?.slice(0, 10) ?? null,
  }))
  filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return filas
}

/** SRV-4 · Un comité. Es `getCompromisosDeComites` con uno solo. */
export async function getMiComite(committeeId: string): Promise<{ nombre: string; filas: FilaDeMiComite[] }> {
  const supabase = createAdminClient()
  const { data: area } = await supabase.from('areas').select('name').eq('id', committeeId).maybeSingle()
  return {
    nombre: (area as { name: string } | null)?.name ?? '',
    filas: await getCompromisosDeComites([committeeId]),
  }
}
