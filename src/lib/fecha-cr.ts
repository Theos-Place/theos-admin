/**
 * Fechas de Costa Rica en los correos, sin correrse un día.
 *
 * EL BUG (2026-09-10). A Sonia Arias le llegó su confirmación de matrícula
 * diciendo que "Sirviendo como Jesús" empezaba el 28 de setiembre. Empieza el
 * 29 — un martes, que es el día del grupo. El 28 era lunes.
 *
 * POR QUÉ. `study_groups.starts_at` es una fecha SIN hora: "2026-09-29".
 * `new Date("2026-09-29")` la interpreta como medianoche UTC, y pedirle que se
 * muestre en zona de Costa Rica (UTC−6) la retrocede seis horas: 28 de
 * setiembre, 6 p.m. Los tres formateadores de correo que trabajan con fechas de
 * grupo tenían cada uno su propia copia de esa línea.
 *
 * LA REGLA. Una fecha sin hora es una fecha CIVIL: el 29 de setiembre es el 29
 * en todo el mundo y no se convierte a ninguna zona. Un instante real
 * (timestamptz) sí se convierte, porque las 7 p.m. de Costa Rica son otra hora
 * en otro lado.
 */
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/
const ZONA_CR = 'America/Costa_Rica'

export type FormatoFecha = 'larga' | 'larga-2d' | 'corta' | 'numerica'

const OPCIONES: Record<FormatoFecha, Intl.DateTimeFormatOptions> = {
  larga: { day: 'numeric', month: 'long', year: 'numeric' },
  // Con cero adelante ("01 de junio"). Es como venían escribiéndolo los
  // correos; se conserva para no cambiarles la cara de paso.
  'larga-2d': { day: '2-digit', month: 'long', year: 'numeric' },
  corta: { day: 'numeric', month: 'short', year: 'numeric' },
  numerica: { day: '2-digit', month: '2-digit', year: 'numeric' },
}

/**
 * @param valor  "YYYY-MM-DD" (fecha civil) o un instante ISO completo.
 * @returns el texto en español, o '' si no hay nada / no se entiende.
 */
export function fechaCR(valor: string | null | undefined, formato: FormatoFecha = 'larga'): string {
  if (!valor) return ''
  const opciones = OPCIONES[formato]

  if (SOLO_FECHA.test(valor)) {
    // Se arma en UTC y se formatea en UTC: así el resultado es el mismo en la
    // compu de quien desarrolla (Costa Rica) y en el servidor (UTC). Armarla en
    // hora local y formatearla en local también funcionaría, pero se rompe en
    // cuanto alguien le agrega un timeZone a la llamada.
    const [a, m, d] = valor.split('-').map(Number)
    const civil = new Date(Date.UTC(a, m - 1, d))
    if (Number.isNaN(civil.getTime())) return valor
    return civil.toLocaleDateString('es-CR', { ...opciones, timeZone: 'UTC' })
  }

  const instante = new Date(valor)
  if (Number.isNaN(instante.getTime())) return valor
  return instante.toLocaleDateString('es-CR', { ...opciones, timeZone: ZONA_CR })
}

/** ¿Este valor es una fecha civil (sin hora)? Útil para decidir si además
 *  tiene sentido mostrar una hora al lado. */
export function esFechaCivil(valor: string | null | undefined): boolean {
  return !!valor && SOLO_FECHA.test(valor)
}
