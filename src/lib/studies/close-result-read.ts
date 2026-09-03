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
 *
 * Y hay un tercer caso, que se descubrió con datos reales el 2026-09-02: la
 * importación de PCO (18-jul-2026 18:53) dejó 312 inscripciones marcadas
 * `completed` con una fecha de aprobación ANTERIOR al arranque de su propio
 * grupo — gente que llevó el nivel años antes y quedó pegada a un grupo
 * reciente. Contarlas como aprobados de ESE cierre es falso: el cierre del
 * Nivel 3 de Jhonny Leandro reportaba 8 aprobados cuando el dirigente evaluó
 * 6, y las otras 2 traían fechas de 2022.
 *
 * Se clasifican como 'historico' y se cuentan aparte. La regla es la fecha:
 * si aprobó antes de que el grupo empezara, no aprobó en ese grupo.
 */

export type ResultadoCierre =
  | 'aprobado'
  | 'reprobado'
  | 'retirado'
  | 'sin_evaluar'
  /** Aprobó ANTES de que este grupo empezara: arrastre de la importación. */
  | 'historico'
  | 'otro'

export function clasificarResultado(
  fila: {
    status: string | null | undefined
    notes: string | null | undefined
    completed_at?: string | null | undefined
  },
  /** Arranque del grupo (YYYY-MM-DD). Sin este dato no se puede separar el
   *  arrastre de la importación, y un aprobado histórico pasa por aprobado
   *  del cierre. */
  inicioGrupo?: string | null,
): ResultadoCierre {
  const status = (fila.status ?? '').trim()
  // El status explícito manda: si alguien lo puso, es la intención más clara.
  if (status === 'reprobado') return 'reprobado'
  if (status === 'dropped') return 'retirado'
  // 'cancelada' no es un resultado: la matrícula nunca llegó a darse, así que
  // no cuenta ni como retiro ni como nada. Cae en 'otro' y queda fuera del
  // conteo del cierre.
  if (status === 'cancelada') return 'otro'
  if (status === 'en_revision') return 'sin_evaluar'
  if (status === 'completed') {
    // El RPC guarda la reprobación en la nota, no en el status.
    if (/^\s*reprobado\b/i.test(fila.notes ?? '')) return 'reprobado'
    if (esHistorico(fila.completed_at, inicioGrupo)) return 'historico'
    return 'aprobado'
  }
  return 'otro'
}

/** ¿Aprobó antes de que el grupo arrancara? Con cualquiera de las dos fechas
 *  ausente se responde NO: sin datos no se descarta a nadie del conteo. */
export function esHistorico(
  completedAt: string | null | undefined,
  inicioGrupo: string | null | undefined,
): boolean {
  const fin = (completedAt ?? '').slice(0, 10)
  const inicio = (inicioGrupo ?? '').slice(0, 10)
  if (!fin || !inicio) return false
  return fin < inicio
}

export type ConteoCierre = {
  /** Aprobaron EN este cierre. Es el número que manda para los folletos. */
  aprobados: number
  reprobados: number
  retirados: number
  /** Quedaron sin evaluar: la cantidad de folletos todavía puede moverse. */
  sin_evaluar: number
  /** Ya tenían el nivel aprobado de antes (arrastre de la importación de PCO).
   *  No avanzan de nivel y no llevan folleto. */
  historicos: number
}

export function contarResultadosCierre(
  filas: ReadonlyArray<{
    status: string | null | undefined
    notes: string | null | undefined
    completed_at?: string | null | undefined
  }>,
  inicioGrupo?: string | null,
): ConteoCierre {
  const c: ConteoCierre = { aprobados: 0, reprobados: 0, retirados: 0, sin_evaluar: 0, historicos: 0 }
  for (const f of filas) {
    switch (clasificarResultado(f, inicioGrupo)) {
      case 'aprobado': c.aprobados++; break
      case 'reprobado': c.reprobados++; break
      case 'retirado': c.retirados++; break
      case 'sin_evaluar': c.sin_evaluar++; break
      case 'historico': c.historicos++; break
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
