/**
 * Quién puede ser agregado a un comité, y qué pasa con quien ya estuvo.
 *
 * BUG 2026-09-09 (caso Juan Carlos Obando Marchena): dejó de servir, volvió, y
 * no había forma de reincorporarlo. La causa NO estaba en la API —el alta hace
 * upsert sobre UNIQUE(member_id, position_id) y reactiva bien— sino en el
 * buscador de candidatos, que descartaba a TODA persona con un registro en el
 * comité, activo o inactivo. Quien alguna vez sirvió ahí quedaba excluido para
 * siempre del buscador y no aparecía como opción.
 *
 * "Un mae que regresó" es cotidiano. La regla correcta no es esconderlo: es
 * mostrarlo, decir que ya estuvo, y que agregarlo lo REACTIVE.
 */

export type RegistroDeServidor = {
  member_id: string
  /** El puesto concreto. Una persona puede tener varios en el mismo comité. */
  position_id?: string | null
  status: string
}

export type Candidatura =
  /** No tiene historial en el comité: alta normal. */
  | { tipo: 'nuevo' }
  /** Tuvo puesto(s) acá y ya no sirve: agregar significa REACTIVAR. */
  | { tipo: 'reintegro'; puestosInactivos: string[] }
  /** Ya sirve activo. Se puede sumar OTRO puesto, no repetir el mismo. */
  | { tipo: 'ya_sirve'; puestosActivos: string[] }

/**
 * Qué significa agregar a esta persona a este comité.
 *
 * Se devuelve el caso completo en vez de un booleano "se puede o no": la
 * pantalla necesita decir POR QUÉ —"ya sirvió acá, se va a reactivar"— y con un
 * sí/no no se puede.
 */
export function candidaturaEnComite(
  memberId: string,
  registrosDelComite: readonly RegistroDeServidor[],
): Candidatura {
  const suyos = registrosDelComite.filter(r => r.member_id === memberId)
  if (suyos.length === 0) return { tipo: 'nuevo' }
  const activos = suyos.filter(r => r.status === 'active')
  if (activos.length > 0) {
    return { tipo: 'ya_sirve', puestosActivos: activos.map(r => r.position_id ?? '').filter(Boolean) }
  }
  return { tipo: 'reintegro', puestosInactivos: suyos.map(r => r.position_id ?? '').filter(Boolean) }
}

/**
 * ¿Se oculta del buscador de candidatos?
 *
 * SOLO quien ya sirve ACTIVO en el comité — a esa persona no se la "agrega", se
 * le suma otro puesto desde su propia fila. Quien está inactivo SÍ aparece:
 * es exactamente el caso que estaba roto.
 */
export function seOcultaDelBuscador(
  memberId: string,
  registrosDelComite: readonly RegistroDeServidor[],
): boolean {
  return candidaturaEnComite(memberId, registrosDelComite).tipo === 'ya_sirve'
}

/** Puestos del comité que la persona todavía NO tiene activos — los que se le
 *  pueden sumar. Sin esto el selector ofrecería un puesto que ya tiene y el
 *  upsert lo dejaría igual, pareciendo que no hizo nada. */
export function puestosQueSePuedenSumar(
  memberId: string,
  puestosDelComite: ReadonlyArray<{ id: string; title: string }>,
  registrosDelComite: readonly RegistroDeServidor[],
): Array<{ id: string; title: string }> {
  const yaActivos = new Set(
    registrosDelComite
      .filter(r => r.member_id === memberId && r.status === 'active')
      .map(r => r.position_id),
  )
  return puestosDelComite.filter(p => !yaActivos.has(p.id))
}

/**
 * ¿Quitarle ESTE puesto le quita también el rol automático?
 *
 * No, si otro de sus puestos activos respalda el mismo rol. La base ya lo
 * modela con member_role_position_grants (una fila por puesto que respalda el
 * rol) y revoke_position_role solo quita el rol cuando se cae el último
 * respaldo. Esta función es para que la PANTALLA pueda avisarlo antes.
 */
export function perderaElRol(
  positionIdQueSeQuita: string,
  respaldosDelRol: readonly string[],
): boolean {
  return respaldosDelRol.filter(p => p !== positionIdQueSeQuita).length === 0
}
