/**
 * Quién es "encargado" de un comité (SRV-5).
 *
 * DIAGNÓSTICO 2026-09-18 — había DOS fuentes en producción y no coincidían:
 *
 *  - El puesto "Encargado…" del comité: 35 de 46 comités activos, ya admite
 *    varios (Comité Matrimonios tiene 4) y ya otorga el rol `lider_comite` por
 *    `position-roles` + `member_role_position_grants`.
 *  - `areas.leader_id`, un campo único: solo 13 comités, y en 2 apuntaba a una
 *    persona DISTINTA de la del puesto (Ayuda Social y Contabilidad; verificado
 *    que no eran fichas duplicadas — hay cinco Carolina Salas en el padrón).
 *
 * Por decisión del usuario, la fuente única pasa a ser EL PUESTO. `leader_id`
 * deja de ser el dato y se deriva de acá; los 3 encargados que solo vivían en
 * ese campo recibieron su puesto en la migración, sin quitarle el puesto a
 * nadie.
 *
 * Ojo con la diferencia entre este módulo y la regla `lider_comite` de
 * `position-roles`: "Encargado Sede" SÍ es la cabeza de un comité de sede
 * (puede pedir vacantes, lleva la estrella), pero NO recibe `lider_comite` —
 * los comités de sede quedan fuera de ese rol por decisión del 2026-09-11.
 */
import { normSinArticulos } from './position-roles'

/**
 * Títulos que NO son la cabeza del comité aunque empiecen con "Encargado".
 *
 * Estaba "Encargado Logística" y ERA UN ERROR, reportado por el Comité de
 * Servidores el 2026-09-21: en una sede, quien tiene ese puesto SÍ es quien la
 * encabeza. Como el título no calificaba, la estrella no lo encontraba y creaba
 * un puesto "Encargado Sede" que nadie había pedido — "ese puesto no existe".
 *
 * El puesto existe solo en comités de sede (11, verificado), así que aceptarlo
 * no le pone la estrella a nadie de otro lado.
 *
 * OJO, no confundir con el rol `lider_comite`: ahí los comités de sede siguen
 * excluidos por decisión del 2026-09-11. Una cosa es encabezar la sede —llevar
 * la estrella, poder pedir vacantes— y otra es el rol que abre "Mi comité".
 */
const NO_SON_CABEZA = new Set<string>()

/**
 * ¿Este título es el de la persona a cargo del comité?
 *
 * Se compara por PREFIJO y no contra una lista de títulos: la sincronización
 * del Excel Madre (2026-09-11) renombró los "Encargado" a "Encargado <Comité>"
 * y una lista se habría desactualizado sola. Hoy conviven "Encargado Comité",
 * "Encargado de comité", "Encargado Dirigentes", "Encargado Oración" y
 * "Encargado Sede".
 */
export function esPuestoDeEncargado(title: string): boolean {
  const t = normSinArticulos(title)
  if (NO_SON_CABEZA.has(t)) return false
  return t === 'encargado' || t.startsWith('encargado ')
}

export type PuestoOcupado = {
  title: string
  status: string
  member_id: string
}

/**
 * Los member_id de quienes están a cargo del comité, sin repetir.
 *
 * Solo cuentan las asignaciones ACTIVAS: un encargado dado de baja dejó de
 * serlo, y si siguiera contando se quedaría con el permiso de pedir vacantes.
 */
export function encargadosDelComite(puestos: readonly PuestoOcupado[]): string[] {
  const ids = new Set<string>()
  for (const p of puestos) {
    if (p.status !== 'active') continue
    if (!esPuestoDeEncargado(p.title)) continue
    ids.add(p.member_id)
  }
  return [...ids]
}

/** Nombres de los encargados para mostrar en una línea. '' si no hay. */
export function nombresDeEncargados(encargados: readonly { name: string }[]): string {
  return encargados.map(e => e.name).filter(Boolean).join(', ')
}

export type PuestoDelComite = {
  id: string
  title: string
  /** ¿La persona en cuestión lo ocupa hoy (activo)? */
  ocupa: boolean
  /** Cuánta gente activa tiene. */
  ocupantes: number
}

export type PlanDeEncargado =
  | { accion: 'nada' }
  /** Ya no queda ningún puesto suyo: quitarle la estrella la sacaría del comité. */
  | { accion: 'bloqueado'; motivo: 'unico_puesto' }
  | { accion: 'quitar'; puestos: string[] }
  | { accion: 'sumar'; puestoId: string }
  | { accion: 'crear_y_sumar' }

/**
 * Qué hay que hacer para marcar o desmarcar a alguien como encargado.
 *
 * Marcar SUMA el puesto y no reemplaza nada: en producción hay 25 personas con
 * más de un puesto en el mismo comité (hasta 5), así que la encargada conserva
 * el suyo.
 */
export function planDeEncargado(
  puestos: readonly PuestoDelComite[],
  encargado: boolean,
): PlanDeEncargado {
  const deEncargado = puestos.filter(p => esPuestoDeEncargado(p.title))
  const suyos = deEncargado.filter(p => p.ocupa)

  if (!encargado) {
    if (!suyos.length) return { accion: 'nada' }
    const otros = puestos.filter(p => p.ocupa && !esPuestoDeEncargado(p.title))
    if (!otros.length) return { accion: 'bloqueado', motivo: 'unico_puesto' }
    return { accion: 'quitar', puestos: suyos.map(p => p.id) }
  }

  if (suyos.length) return { accion: 'nada' }
  if (!deEncargado.length) return { accion: 'crear_y_sumar' }
  // El puesto con más gente primero: cuando conviven "Encargado Comité" y
  // "Encargado de comité" (pasa en Comité de Planificación), el bueno es el que
  // la gente usa, no el que se creó antes.
  const destino = [...deEncargado].sort((a, b) => b.ocupantes - a.ocupantes)[0]
  return { accion: 'sumar', puestoId: destino.id }
}
