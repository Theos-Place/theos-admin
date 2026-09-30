/**
 * REP-11 · Qué PUESTO abre los reportes de crecimiento y personas nuevas.
 *
 * REVIERTE PAR-3, que había resuelto esto de la manera ancha: el puesto de
 * anfitrión otorgaba el ROL `reportes` entero, y con él los siete reportes
 * —incluidos Discípulos y Retención, que nadie les había dado—. Medido el
 * 2026-09-30: 21 de las 29 personas con ese rol lo tenían así, todas
 * anfitriones.
 *
 * Ahora el puesto no otorga ningún rol: abre DOS reportes y nada más. La
 * diferencia importa porque un rol se queda pegado a la persona y se ve en
 * todas las pantallas que lo pregunten, mientras que esto se responde reporte
 * por reporte (`ACCESO_POR_REPORTE`).
 *
 * `encargado de logística` se suma acá y no estaba en PAR-3: es quien arma la
 * sede y necesita los mismos números que el anfitrión.
 *
 * Módulo PURO.
 */
import { esComiteDeSede, normSinArticulos, type PositionContext } from '@/lib/servers/position-roles'
import { ANFITRIONES_QUE_ABREN_MI_COMITE } from '@/lib/servers/puestos-que-abren-mi-comite'

/**
 * Títulos que abren los reportes de su sede.
 *
 * Los anfitriones se reusan de SRV-16 A PROPÓSITO: es la misma gente y la
 * misma decisión del mismo día, y dos listas con los mismos títulos se
 * separan en cuanto alguien agregue una variante a una sola. Lo que NO se
 * reusa es la lista entera de `abreMiComite`, que incluye a cualquier
 * encargado de cualquier comité: esto es de SEDES.
 *
 * `encargado logistica` es el título real del catálogo (13 puestos con acento
 * y 1 sin él, verificado el 2026-09-30); `normSinArticulos` los junta.
 * «Asistente Logística» y «Colaborador Logística» NO entran.
 */
export const PUESTOS_QUE_ABREN_REPORTES = new Set([
  ...ANFITRIONES_QUE_ABREN_MI_COMITE,
  'encargado logistica',
])

export function abreReportesDeSede(ctx: PositionContext): boolean {
  if (ctx.areaType !== 'committee') return false
  // Acotado al comité de SEDE, no al título suelto — mismo criterio que
  // PAR-3 y SRV-16: un «Anfitrión» creado mañana para un evento puntual no se
  // lleva los reportes de la organización.
  return esComiteDeSede(ctx) && PUESTOS_QUE_ABREN_REPORTES.has(normSinArticulos(ctx.title))
}
