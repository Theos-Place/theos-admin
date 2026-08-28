/**
 * Filas del export "grupos con sus participantes": una por PERSONA, con el
 * grupo repetido, para que en Excel se pueda filtrar y hacer tabla dinámica.
 *
 * Módulo puro: arma y ordena las filas. La consulta vive en queries/studies.
 */

export type RolEnGrupo = 'Dirigente' | 'Co-dirigente' | 'Estudiante'

export type FilaParticipante = {
  grupo: string
  codigo: string
  estudio: string
  /** Costo del PLAN, que es de donde sale — el grupo no lo guarda aparte. */
  costo: number
  moneda: string
  estado_grupo: string
  inicio: string
  fin: string
  persona: string
  rol: RolEnGrupo
  estado_inscripcion: string
  correo: string
  telefono: string
  cedula: string
}

/** Cómo se muestra el estado de una inscripción en el export. */
export const ESTADO_INSCRIPCION: Record<string, string> = {
  enrolled: 'Cursando',
  completed: 'Aprobado',
  reprobado: 'Reprobado',
  dropped: 'Retirado',
  transferred: 'Trasladado',
  waitlist: 'En espera',
  pendiente_de_pago: 'Pendiente de pago',
  expirada: 'Expirada',
  en_revision: 'Por confirmar',
}

export type GrupoParaExport = {
  id: string
  name: string | null
  status: string
  starts_at: string | null
  ends_at: string | null
  leader_id: string | null
  co_leader_id: string | null
  plan: { code: string | null; name: string | null; cost: number | null; currency: string | null } | null
  enrollments: Array<{ member_id: string; status: string }>
}

export type PersonaMin = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  cedula: string | null
}

const nombre = (p?: PersonaMin) => p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : ''

/**
 * Aplana grupos + gente en filas.
 *
 * El dirigente y el co-dirigente van como FILAS del grupo, no como una columna
 * al lado: quien abre esto quiere ver "quiénes están en este grupo" de un
 * vistazo, y el dirigente es uno de ellos. Si además está matriculado como
 * estudiante (pasa en capacitaciones), aparece con su rol de dirigente y no se
 * duplica.
 */
export function armarFilas(
  grupos: GrupoParaExport[],
  personas: Map<string, PersonaMin>,
): FilaParticipante[] {
  const filas: FilaParticipante[] = []
  for (const g of grupos) {
    const base = {
      grupo: g.name ?? '',
      codigo: g.plan?.code ?? '',
      estudio: g.plan?.name ?? '',
      costo: Number(g.plan?.cost ?? 0),
      moneda: g.plan?.currency ?? 'CRC',
      estado_grupo: g.status,
      inicio: g.starts_at ?? '',
      fin: g.ends_at ?? '',
    }
    const yaPuesto = new Set<string>()
    const agregar = (memberId: string | null, rol: RolEnGrupo, estado: string) => {
      if (!memberId || yaPuesto.has(memberId)) return
      yaPuesto.add(memberId)
      const p = personas.get(memberId)
      filas.push({
        ...base,
        persona: nombre(p) || '(miembro no encontrado)',
        rol,
        estado_inscripcion: estado,
        correo: p?.email ?? '',
        telefono: p?.phone ?? '',
        cedula: p?.cedula ?? '',
      })
    }
    agregar(g.leader_id, 'Dirigente', '—')
    agregar(g.co_leader_id, 'Co-dirigente', '—')
    for (const e of g.enrollments) {
      agregar(e.member_id, 'Estudiante', ESTADO_INSCRIPCION[e.status] ?? e.status)
    }
  }
  // Por grupo, y dentro del grupo: dirigente, co-dirigente y después los
  // estudiantes por nombre. Así el Excel se lee de corrido.
  const ORDEN: Record<RolEnGrupo, number> = { 'Dirigente': 0, 'Co-dirigente': 1, 'Estudiante': 2 }
  return filas.sort((a, b) =>
    a.grupo.localeCompare(b.grupo, 'es')
    || ORDEN[a.rol] - ORDEN[b.rol]
    || a.persona.localeCompare(b.persona, 'es'))
}
