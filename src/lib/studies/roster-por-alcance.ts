/**
 * Qué ve cada quien en la lista de participantes de un grupo (GRU-3).
 *
 * TRES VISTAS Y NO DOS. Hasta ahora la pantalla distinguía "gestiona" de "no
 * gestiona", y el estudiante quedaba sin ver nada: el endpoint le devolvía SU
 * propia inscripción y nada más, así que abría el grupo y no veía con quién lo
 * estaba llevando.
 *
 *   estudiante  lista de compañeros con NOMBRE, nada más
 *   dirigente   nombre + teléfono + cumpleaños, para poder contactarlos y
 *               felicitarlos — pero SIN entrada al perfil de la persona
 *   gestión     todo, incluidas las dos columnas nuevas
 *
 * POR QUÉ SE RECORTA EN EL SERVIDOR. Esconder una columna en la UI no esconde
 * el dato: viaja igual en el JSON y se lee con las herramientas del navegador.
 * El teléfono y la fecha de nacimiento de 23 mil personas no salen del servidor
 * para quien no los necesita.
 *
 * EL PERFIL ES APARTE, y ya estaba bien: `canViewMemberProfile` solo deja el
 * propio y el de la familia, y si no exige módulo `miembros` más allá de 'own'
 * — que un dirigente por sí solo no tiene. Acá lo único que se quita es el
 * enlace, que invitaba a un 403.
 */

export type AlcanceDeVista = 'admin' | 'leader' | 'member' | 'none'

export type PermisosDelRoster = {
  /** ¿Ve la lista de compañeros, o solo lo suyo? */
  verLista: boolean
  verTelefono: boolean
  verCumple: boolean
  /** Nota, notas del cierre, estado de pago: cosas de gestión. */
  verDatosDeGestion: boolean
  /** Enlace al perfil del miembro. NUNCA para un dirigente. */
  verPerfil: boolean
  /** Tab de asistencia y acciones sobre el grupo. */
  verAsistencia: boolean
}

export function permisosDelRoster(scope: AlcanceDeVista): PermisosDelRoster {
  switch (scope) {
    case 'admin':
      return { verLista: true, verTelefono: true, verCumple: true, verDatosDeGestion: true, verPerfil: true, verAsistencia: true }
    case 'leader':
      // El dirigente necesita contactar y felicitar, no auditar a la persona.
      return { verLista: true, verTelefono: true, verCumple: true, verDatosDeGestion: true, verPerfil: false, verAsistencia: true }
    case 'member':
      return { verLista: true, verTelefono: false, verCumple: false, verDatosDeGestion: false, verPerfil: false, verAsistencia: false }
    default:
      return { verLista: false, verTelefono: false, verCumple: false, verDatosDeGestion: false, verPerfil: false, verAsistencia: false }
  }
}

/** Lo que el servidor manda de cada inscripción. Los campos personales son
 *  opcionales porque para el estudiante NO VIAJAN. */
export type FilaDeRoster = {
  id: string
  member_id: string
  status: string | null
  grade?: number | null
  notes?: string | null
  member: {
    first_name: string
    last_name: string
    phone?: string | null
    birth_date?: string | null
  } | null
}

/**
 * Recorta la lista según quién pregunta.
 *
 * `scope === 'none'` devuelve vacío, igual que antes. Para el estudiante se
 * devuelve la lista COMPLETA pero pelada: sin teléfono, sin cumpleaños y sin
 * los campos de gestión (nota y notas del cierre, que son evaluación de otro).
 */
export function recortarRoster(
  filas: readonly FilaDeRoster[],
  scope: AlcanceDeVista,
): FilaDeRoster[] {
  const p = permisosDelRoster(scope)
  if (!p.verLista) return []
  return filas.map(f => ({
    id: f.id,
    member_id: f.member_id,
    status: f.status,
    ...(p.verDatosDeGestion ? { grade: f.grade ?? null, notes: f.notes ?? null } : {}),
    member: f.member
      ? {
          first_name: f.member.first_name,
          last_name: f.member.last_name,
          ...(p.verTelefono ? { phone: f.member.phone ?? null } : {}),
          ...(p.verCumple ? { birth_date: f.member.birth_date ?? null } : {}),
        }
      : null,
  }))
}

/** Día y mes del cumpleaños: "14 set". El año no hace falta para felicitar, y
 *  no mostrarlo evita repartir la edad de la persona por toda la pantalla. */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

export function cumpleCorto(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate.trim())
  if (!m) return null
  const mes = Number(m[2]), dia = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return `${dia} ${MESES[mes - 1]}`
}
