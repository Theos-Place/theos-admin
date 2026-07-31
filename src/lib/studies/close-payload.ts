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

/** Cuántos reprobados quedaron SIN justificación (bloquea el cierre). El
 *  comentario del retirado es opcional, así que no entra en esta cuenta. */
export function failsWithoutReason(rows: readonly CloseRow[]): number {
  return rows.filter(r => r.status_result === 'reprobado' && !r.fail_reason.trim()).length
}
