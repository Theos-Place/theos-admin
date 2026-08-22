// Qué se manda al cerrar un grupo, por estudiante. Puro: la pantalla de cierre
// arma el body con esto y los tests fijan las reglas de qué viaja y qué no.
//
// La regla de fondo: cada campo pertenece a UN resultado. La nota solo tiene
// sentido con nota (aprobado/reprobado), la justificación solo al reprobar, y el
// comentario solo al retirar — mandarlos siempre ensucia el registro con texto
// que quedó de un clic anterior.

export type CloseStatus = 'aprobado' | 'reprobado' | 'retirado'

export type CloseRow = {
  member_id: string
  status_result: CloseStatus | ''
  grade: string
  /** Justificación OBLIGATORIA al reprobar. */
  fail_reason: string
  /** Comentario OPCIONAL al retirar (2026-07-31). */
  withdraw_reason: string
  rec_oracion: boolean
  rec_servicio: boolean
  rec_dirigente: boolean
  rec_justification: string
}

export type ClosePayloadItem = {
  member_id: string
  status_result: CloseStatus
  grade: number | null
  fail_reason: string | null
  withdraw_reason: string | null
  recommendations: {
    oracion: boolean
    servicio: boolean
    dirigente: boolean
    justification: string | null
  } | null
}

/** Convierte una fila del formulario en el item del body. `canRecommend` viene
 *  de EST-3 (solo N4+ y capacitaciones ofrecen recomendaciones). */
export function toClosePayloadItem(row: CloseRow, canRecommend: boolean): ClosePayloadItem {
  const status = row.status_result as CloseStatus
  const hasRec = canRecommend && (row.rec_oracion || row.rec_servicio || row.rec_dirigente)
  return {
    member_id: row.member_id,
    status_result: status,
    grade: row.grade ? Number(row.grade) : null,
    fail_reason: status === 'reprobado' ? row.fail_reason.trim() || null : null,
    withdraw_reason: status === 'retirado' ? row.withdraw_reason.trim() || null : null,
    recommendations: hasRec
      ? {
          oracion: row.rec_oracion,
          servicio: row.rec_servicio,
          dirigente: row.rec_dirigente,
          justification: row.rec_justification.trim() || null,
        }
      : null,
  }
}

/** El body completo: se omiten las filas sin resultado marcado. */
export function toClosePayload(rows: readonly CloseRow[], canRecommend: boolean): ClosePayloadItem[] {
  return rows.filter(r => r.status_result !== '').map(r => toClosePayloadItem(r, canRecommend))
}

/**
 * EST-14 · Largo mínimo de un motivo de retiro.
 *
 * Existe porque el agujero real no era la falta de validación sino un motivo de
 * relleno: el botón "Desinscribir" de la ficha del grupo mandaba hardcodeado
 * 'Desinscrito desde el grupo' sin preguntarle nada a nadie. Un campo
 * obligatorio que acepta cualquier cosa se llena con cualquier cosa, así que el
 * mínimo es lo que separa un motivo de un tecleo.
 */
export const WITHDRAW_REASON_MIN = 10

/** ¿Sirve este texto como motivo de retiro? */
export function withdrawReasonError(reason: string | null | undefined): string | null {
  const v = (reason ?? '').trim()
  if (!v) return 'Escribí el motivo del retiro.'
  if (v.length < WITHDRAW_REASON_MIN) {
    return `El motivo es muy corto: contá en una frase qué pasó (mínimo ${WITHDRAW_REASON_MIN} caracteres).`
  }
  return null
}

/** Qué motivo exige cada resultado. 'aprobado' no pide ninguno. */
export type MissingReason = { member_id: string; status: 'reprobado' | 'retirado' }

/**
 * Filas a las que les falta el motivo OBLIGATORIO. Bloquean el cierre.
 *  · reprobado → fail_reason (justificación)
 *  · retirado  → withdraw_reason (motivo del retiro)
 *
 * 2026-08-04: el motivo del retiro pasó de opcional a OBLIGATORIO. Un retiro sin
 * motivo deja al estudiante fuera del grupo sin rastro de por qué, y es el dato
 * que se necesita después para reubicarlo o darle seguimiento.
 */
export function missingReasons(rows: readonly CloseRow[]): MissingReason[] {
  const falta: MissingReason[] = []
  for (const r of rows) {
    if (r.status_result === 'reprobado' && !r.fail_reason.trim()) {
      falta.push({ member_id: r.member_id, status: 'reprobado' })
    }
    if (r.status_result === 'retirado' && !r.withdraw_reason.trim()) {
      falta.push({ member_id: r.member_id, status: 'retirado' })
    }
  }
  return falta
}

/** Texto del bloqueo: qué falta y de cuál estudiante. `nameOf` resuelve el
 *  nombre (la regla es pura y no conoce el roster). */
export function missingReasonsMessage(
  falta: readonly MissingReason[],
  nameOf: (memberId: string) => string,
): string {
  if (falta.length === 0) return ''
  const partes = falta.map(f => `${nameOf(f.member_id)} (${
    f.status === 'reprobado' ? 'falta la justificación de la reprobación' : 'falta el motivo del retiro'
  })`)
  return partes.length === 1
    ? `Antes de cerrar: ${partes[0]}.`
    : `Antes de cerrar faltan ${partes.length} motivos: ${partes.join('; ')}.`
}
