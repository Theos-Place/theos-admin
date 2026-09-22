/**
 * El PORCENTAJE de asistencia de cada participante de un grupo.
 *
 * NUNCA SE CALCULÓ. El adapter devolvía `attendance_pct: 0` fijo, con un
 * comentario que decía "se calcula en la vista de detalle (Fase 2b)" — y esa
 * fase no llegó. O sea que la barra mostraba 0% para todo el mundo desde
 * siempre; lo reportó una dirigente el 2026-09-22 después de pasar su primera
 * lista y ver que no cambiaba nada.
 *
 * No era solo cosmético: el mismo dato alimenta la pantalla de CIERRE, donde se
 * decide quién aprueba, y los planes tienen `min_attendance_pct`.
 *
 * SOBRE QUÉ SE DIVIDE. Sobre las sesiones REGISTRADAS del grupo, no sobre las
 * que el plan dice que tiene. Un grupo de 11 clases en su semana 1 tiene una
 * sesión: quien vino tiene 100% de lo que hubo, no 9%. Si el dirigente se
 * atrasa registrando, eso es un hueco de datos y no la ausencia de nadie —
 * castigarlo en el porcentaje haría que la pantalla mienta sobre las personas.
 */

/** Presencias de cada miembro y cuántas sesiones hubo. */
export type ConteoDeAsistencia = { presentes: number; sesiones: number }

/** 0–100, redondeado. Sin sesiones registradas todavía: 0. */
export function porcentajeDeAsistencia(c: ConteoDeAsistencia): number {
  if (c.sesiones <= 0) return 0
  return Math.round((c.presentes / c.sesiones) * 100)
}

/**
 * De las filas crudas (una por sesión y miembro) al porcentaje de cada uno.
 *
 * `totalDeSesiones` viaja aparte y NO se deduce de las filas: quien faltó a
 * todas no tiene filas `present`, y contando solo lo que aparece quedaría con
 * 0 sesiones y por lo tanto 0% "de nada" en vez de 0% de las que hubo.
 */
export function porcentajesPorMiembro(
  filas: Array<{ member_id: string; present: boolean }>,
  totalDeSesiones: number,
): Map<string, number> {
  const presentes = new Map<string, number>()
  for (const f of filas) {
    if (f.present) presentes.set(f.member_id, (presentes.get(f.member_id) ?? 0) + 1)
  }
  const out = new Map<string, number>()
  for (const [miembro, n] of presentes) {
    out.set(miembro, porcentajeDeAsistencia({ presentes: n, sesiones: totalDeSesiones }))
  }
  return out
}
