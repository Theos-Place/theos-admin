/**
 * Quién dirige un ÁREA — el nivel que está por encima de los comités.
 *
 * Pedido de Floriana el 2026-09-30: «un campo por encima de los comités que
 * sea el director de área». **No se creó un campo**, y la razón es la misma
 * que hizo falta aprender con los comités: `areas.leader_id` existía, lo
 * llenaban 12 comités de 44, y en DOS apuntaba a una persona distinta de la
 * del puesto. SRV-5 lo declaró muerto y dejó el PUESTO como fuente única.
 * Repetir ese campo un nivel más arriba habría reintroducido el mismo
 * problema, con el agravante de que nadie mira el nivel de área a diario.
 *
 * Así que el director es un PUESTO más, colgado del área en vez de un comité
 * —que es exactamente lo que pidió Floriana: «es un puesto más, solo que está
 * por encima de los comités»—. El modelo ya lo permitía: `service_positions`
 * apunta a `areas` sin exigir que sea un comité, y de hecho **ya había seis
 * áreas con un puesto «Director» asignado** antes de este cambio. Lo que
 * faltaba era nombrarlo bien, completarlo y mostrarlo.
 *
 * Módulo PURO.
 */
import { normSinArticulos, type PositionContext } from './position-roles'

/** El título oficial. Las áreas que lo tenían como «Director» a secas se
 *  renombraron en la migración `20260930170000`. */
export const TITULO_DIRECTOR_DE_AREA = 'Director de Área'

/**
 * Los títulos que cuentan, ya normalizados.
 *
 * `Director` a secas sigue aceptándose a propósito: es como se llamaban los
 * seis puestos que ya existían, y una regla que solo mirara el nombre nuevo
 * habría dejado de reconocerlos si la migración fallara a medias o si alguien
 * crea uno a mano con el nombre viejo. Reconocer de más acá es barato;
 * reconocer de menos es un permiso que no llega y nadie sabe por qué.
 *
 * `normSinArticulos` quita el «de», así que «Director de Área» y «Director
 * Área» son lo mismo.
 */
const TITULOS: ReadonlySet<string> = new Set(['director', 'director area'])

/**
 * ¿Este puesto es el de quien dirige el área?
 *
 * **EXIGE `areaType === 'area'`, y ahí está toda la gracia.** El comité
 * «Directores» tiene los puestos «Director Ejecutivo» y «Director General»
 * (3 personas, medido el 2026-09-30) y NO son directores de área: son otro
 * cargo, en un comité. La comparación además es contra títulos exactos y no
 * por prefijo «director», justamente para no llevárselos por delante.
 */
export function esPuestoDeDirectorDeArea(ctx: PositionContext): boolean {
  if (ctx.areaType !== 'area') return false
  return TITULOS.has(normSinArticulos(ctx.title))
}

/** La versión que solo mira el título, para cuando el llamador YA sabe que
 *  está parado en un área (una consulta filtrada por `area_type='area'`). */
export function tituloEsDeDirectorDeArea(title: string): boolean {
  return TITULOS.has(normSinArticulos(title))
}

/**
 * Los nombres de quienes dirigen el área, para mostrarlos en una línea.
 *
 * Admite VARIOS, y no es un descuido: Área Enseñanza tiene dos directores
 * (Luis Guillermo Alonso y Maria Adelia Piza) y Floriana confirmó que está
 * bien. Un diseño de un solo director habría obligado a elegir a uno, que es
 * justo el error que cometió `areas.leader_id` al ser una columna única.
 */
export function nombresDeDirectores(directores: readonly { name: string }[]): string {
  return directores.map(d => d.name).filter(Boolean).join(', ')
}
