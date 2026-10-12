/**
 * MAT-3 · Cuándo NO se puede borrar un grupo.
 *
 * EL CASO REAL (2026-10-12, N1 — Escazú de Guido Chavarría). Dos personas se
 * matricularon a las 09:12 y pagaron su cobro de ₡5.000. A las 10:14 las
 * trasladaron al grupo nuevo —correcto: no se recobra, el cobro ya existe— y
 * ocho segundos después borraron el grupo viejo. Las matrículas `transferred`
 * que vivían ahí se fueron con él, y como las FK de `payments` son ON DELETE
 * SET NULL, los dos cobros quedaron sin `enrollment_id` y sin
 * `study_group_id`: ₡10.000 reales, pendientes, que ya no cuelgan de ningún
 * estudio. En la pantalla del grupo esas dos personas aparecen sin cobro, al
 * lado de cuatro que sí lo tienen — el «cobro distinto al resto» que se
 * reportó.
 *
 * POR QUÉ EL GUARD VIEJO NO LO VIO. Miraba solo los estados ACTIVOS
 * (enrolled, waitlist, pendiente_de_pago), o sea «no hay nadie cursando
 * acá». Es verdad y no alcanza: una matrícula transferida o completada no
 * tiene a nadie adentro pero sí tiene historial, y a veces tiene plata.
 *
 * La regla nueva mira las dos cosas que el borrado destruye y no se pueden
 * reconstruir: el DINERO y el HISTORIAL de la persona.
 */

export type EstadoDeBorrado = {
  /** Cobros ligados a las matrículas del grupo que no están cancelados. */
  pagosVivos: number
  /** Matrículas que se fueron a otro grupo: su rastro vive acá. */
  transferidas: number
  /** Matrículas terminadas: es el expediente de la persona. */
  completadas: number
}

/**
 * Devuelve el motivo por el que NO se puede borrar, o null si se puede.
 *
 * El texto es el que ve quien aprieta el botón, así que dice qué hacer, no
 * solo que no se puede: un «no se permite» sin salida termina en alguien
 * borrando por SQL.
 */
export function razonParaNoBorrarGrupo(e: EstadoDeBorrado): string | null {
  if (e.pagosVivos > 0) {
    return e.pagosVivos === 1
      ? 'Este grupo tiene 1 cobro sin cancelar. Si se borra, ese cobro queda '
        + 'suelto y deja de aparecer en el estudio. Anulá o trasladá el cobro primero.'
      : `Este grupo tiene ${e.pagosVivos} cobros sin cancelar. Si se borra, esos `
        + 'cobros quedan sueltos y dejan de aparecer en el estudio. Anulalos o '
        + 'trasladalos primero.'
  }
  if (e.transferidas > 0) {
    return `Hay ${e.transferidas} matrícula${e.transferidas === 1 ? '' : 's'} que se `
      + 'trasladó a otro grupo desde acá. Borrar el grupo borra ese rastro y la '
      + 'persona queda en el grupo nuevo como si nunca hubiera estado en este.'
  }
  if (e.completadas > 0) {
    return `Hay ${e.completadas} persona${e.completadas === 1 ? '' : 's'} que terminó `
      + 'este estudio. Eso es su expediente: borrarlo le quita el estudio del historial.'
  }
  return null
}

/** Los estados que cuentan como historial y hay que proteger. */
export const ESTADOS_CON_HISTORIAL = ['transferred', 'completed'] as const
