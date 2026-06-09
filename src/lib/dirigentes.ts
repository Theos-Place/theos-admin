// Fuente única de verdad para la lista de DIRIGENTES, unificando:
//  A) servidores activos del comité "Dirigentes" (estado ACTIVO)
//  B) cualquier miembro que haya liderado ≥1 grupo de estudio (leader_id)
// Un miembro que solo aparece por (B) queda INACTIVO.
//
// Esta es una función PURA: recibe la data ya cargada (grupos del dominio,
// planes, y los ids de dirigentes activos del comité) y arma la lista enriquecida.

import type { StudyGroup, StudyType } from '@/types/study'

export type DirigenteEstado = 'activo' | 'inactivo'

export type DirigenteGrupo = {
  plan_code: string
  plan_name: string
  group_id: string
  group_name: string
  students_count: number
  status: StudyGroup['status']
  date: string | null
}

export type Dirigente = {
  member_id: string
  member_name: string
  status: DirigenteEstado
  /** Códigos de estudio que el dirigente ha impartido (distintos). */
  estudios_habilitados: string[]
  /** Grupos en curso ahora (open / in_progress / pendientes). */
  estudios_activos: DirigenteGrupo[]
  /** Grupos finalizados que lideró. */
  estudios_completados: DirigenteGrupo[]
  total_grupos: number
  total_activos: number
}

export type ActiveDirigente = { member_id: string; member_name: string }

const enrolled = (g: StudyGroup) => g.participants.filter(p => p.status !== 'withdrawn').length

/** Arma la lista unificada de dirigentes. */
export function buildDirigentes(
  groups: StudyGroup[],
  plans: StudyType[],
  activeDirigentes: ActiveDirigente[],
  /** Designados manualmente (tabla study_leaders): aparecen aunque no hayan
   *  liderado grupos. Quedan INACTIVO salvo que estén en el comité activo. */
  designated: ActiveDirigente[] = [],
): Dirigente[] {
  const planName = (code: string) => plans.find(p => p.code === code)?.name ?? code
  const activeMap = new Map(activeDirigentes.map(a => [a.member_id, a.member_name]))
  const designatedMap = new Map(designated.map(a => [a.member_id, a.member_name]))

  type Acc = { name: string; activos: DirigenteGrupo[]; completados: DirigenteGrupo[]; codes: Set<string> }
  const byLeader = new Map<string, Acc>()

  for (const g of groups) {
    if (!g.leader_id) continue
    if (!byLeader.has(g.leader_id)) {
      byLeader.set(g.leader_id, { name: g.leader_name ?? '', activos: [], completados: [], codes: new Set() })
    }
    const acc = byLeader.get(g.leader_id)!
    acc.codes.add(g.study_type_id)
    const entry: DirigenteGrupo = {
      plan_code: g.study_type_id,
      plan_name: planName(g.study_type_id),
      group_id: g.id,
      group_name: g.name || planName(g.study_type_id),
      students_count: enrolled(g),
      status: g.status,
      date: g.end_date ?? g.start_date ?? null,
    }
    if (g.status === 'finished') acc.completados.push(entry)
    else acc.activos.push(entry)
  }

  // Unión: lideraron grupos ∪ activos del comité ∪ designados manualmente.
  const ids = new Set<string>([...byLeader.keys(), ...activeMap.keys(), ...designatedMap.keys()])
  const out: Dirigente[] = []
  for (const id of ids) {
    const acc = byLeader.get(id)
    const name = activeMap.get(id) || acc?.name || designatedMap.get(id) || ''
    const completados = (acc?.completados ?? []).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    const activos = (acc?.activos ?? []).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    out.push({
      member_id: id,
      member_name: name,
      status: activeMap.has(id) ? 'activo' : 'inactivo',
      estudios_habilitados: [...(acc?.codes ?? [])],
      estudios_activos: activos,
      estudios_completados: completados,
      total_grupos: completados.length + activos.length,
      total_activos: activos.length,
    })
  }
  // Activos primero, luego por cantidad de grupos liderados, luego por nombre.
  return out.sort((a, b) =>
    Number(b.status === 'activo') - Number(a.status === 'activo')
    || b.total_grupos - a.total_grupos
    || a.member_name.localeCompare(b.member_name),
  )
}
