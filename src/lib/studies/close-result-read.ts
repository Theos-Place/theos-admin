/**
 * Cómo LEER el resultado de un cierre (módulo puro).
 *
 * Los reprobados están guardados de dos formas distintas en producción, y esto
 * no es teoría: verificado el 2026-09-02 sobre 36.773 inscripciones.
 *
 *   · 185 filas con `status = 'reprobado'`.
 *   ·  11 filas con `status = 'completed'` y `notes` que arranca en
 *     "reprobado: …" — así los escribe el RPC `close_group` vigente, que
 *     nunca usa el status 'reprobado' aunque la tabla lo permita.
 *
 * Quien lea solo el status cuenta esos 11 como APROBADOS, y de ahí sale un
 * conteo de folletos de más y un dato falso en el correo. Por eso la lectura
 * vive acá, con tests, y no repetida en cada consulta.
 *
 * 'en_revision' se reporta aparte a propósito: es gente que quedó sin evaluar,
 * no gente que aprobó ni que perdió. Meterla en cualquiera de los dos baldes
 * sería inventar un resultado que nadie registró.
 */

export type ResultadoCierre = 'aprobado' | 'reprobado' | 'retirado' | 'sin_evaluar' | 'otro'

export function clasificarResultado(fila: {
  status: string | null | undefined
  notes: string | null | undefined
}): ResultadoCierre {
  const status = (fila.status ?? '').trim()
  // El status explícito manda: si alguien lo puso, es la intención más clara.
  if (status === 'reprobado') return 'reprobado'
  if (status === 'dropped') return 'retirado'
  if (status === 'en_revision') return 'sin_evaluar'
  if (status === 'completed') {
    // El RPC guarda la reprobación en la nota, no en el status.
    return /^\s*reprobado\b/i.test(fila.notes ?? '') ? 'reprobado' : 'aprobado'
  }
  return 'otro'
}

export type ConteoCierre = {
  aprobados: number
  reprobados: number
  retirados: number
  /** Quedaron sin evaluar: la cantidad de folletos todavía puede moverse. */
  sin_evaluar: number
}

export function contarResultadosCierre(
  filas: ReadonlyArray<{ status: string | null | undefined; notes: string | null | undefined }>,
): ConteoCierre {
  const c: ConteoCierre = { aprobados: 0, reprobados: 0, retirados: 0, sin_evaluar: 0 }
  for (const f of filas) {
    switch (clasificarResultado(f)) {
      case 'aprobado': c.aprobados++; break
      case 'reprobado': c.reprobados++; break
      case 'retirado': c.retirados++; break
      case 'sin_evaluar': c.sin_evaluar++; break
      default: break // 'enrolled', 'pendiente_de_pago', 'expirada': cupos, no resultados
    }
  }
  return c
}

/** El motivo escrito al cerrar, sin el prefijo técnico que le pone la base.
 *  Sirve para mostrárselo a una persona tal como lo escribió el dirigente. */
export function motivoLegible(fila: {
  status: string | null | undefined
  notes: string | null | undefined
  drop_reason: string | null | undefined
}): string | null {
  const r = clasificarResultado(fila)
  if (r === 'reprobado') {
    const m = (fila.notes ?? '').match(/^\s*reprobado\s*:\s*([\s\S]+)$/i)
    return m ? m[1].trim() : null
  }
  if (r === 'retirado') {
    const dr = (fila.drop_reason ?? '').trim()
    if (!dr) return null
    const m = dr.match(/^Retirado en cierre\s*:\s*([\s\S]+)$/i)
    return m ? m[1].trim() : (dr === 'Retirado en cierre' ? null : dr)
  }
  return null
}
