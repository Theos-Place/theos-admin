/**
 * REP-17 · De qué COMITÉ es un pago, para el reporte de finanzas.
 *
 * Pedido de Floriana (2026-10-14): «donde dice por entidad, agruparlos por
 * comité: estudios (que abarca niveles, capacitaciones…), eventos de ayuda
 * social, sports, servidores…». El reporte agrupaba por ENTIDAD (cada grupo,
 * cada evento), que con 2.000 grupos no dice nada; acá se agrupa por lo que
 * la organización llama área.
 *
 * Dos capas, porque se filtra en las dos:
 *  · el ÁREA ('estudios' | 'eventos' | 'otro'): «todo estudios»;
 *  · la CATEGORÍA dentro del área: niveles, discípulos, capacitaciones,
 *    prematrimonial; y para eventos, el TIPO del evento (ayuda social,
 *    sports, taller…), que es el catálogo vivo de `event_types`.
 *
 * LOS FOLLETOS VAN CON SU ESTUDIO (Floriana, 2026-10-14): «todos los folletos
 * deberían ir asociados a un estudio». Un cobro de folletos de un N2 es plata
 * de Niveles, no una categoría aparte. Si alguno llegara sin grupo, se dice
 * («Folletos sin estudio») en vez de esconderlo dentro de otra categoría.
 *
 * Módulo PURO.
 */

import { STUDY_GROUPS } from '@/lib/studies/study-grouping'

export type AreaDePago = 'estudios' | 'eventos' | 'otro'

/** Lo mínimo que hace falta saber de un pago para ubicarlo. */
export type PagoParaCategoria = {
  concept?: string | null
  entity_type?: 'event' | 'study_group' | null
  /** `events.event_type` (slug del catálogo). */
  event_type?: string | null
  /** `study_plans.code` del grupo. */
  plan_code?: string | null
  /** `study_plans.level`: 'niveles' | 'etapa_inicial' | … */
  plan_level?: string | null
}

export type CategoriaDePago = { area: AreaDePago; categoria: string }

const DISCIPULOS = new Set(STUDY_GROUPS.discipulos.codes)
const NIVELES = new Set(STUDY_GROUPS.niveles.codes)

/**
 * La clave de la categoría es `<area>:<categoria>` para que un `<select>`
 * la lleve en un solo valor. Para eventos la categoría es el slug del tipo
 * (`eventos:sports`); el nombre bonito lo pone la pantalla con el catálogo.
 */
export function categoriaDePago(p: PagoParaCategoria): CategoriaDePago {
  const c = (p.concept ?? '').toLowerCase()
  if (c === 'prematrimonial') return { area: 'estudios', categoria: 'prematrimonial' }
  const esEvento = c === 'evento' || p.entity_type === 'event'
  if (esEvento) return { area: 'eventos', categoria: (p.event_type ?? '').trim() || 'sin-tipo' }
  const esEstudio = c === 'matricula' || c === 'folletos' || p.entity_type === 'study_group'
  if (esEstudio) {
    if (c === 'folletos' && !p.plan_code && !p.plan_level) return { area: 'estudios', categoria: 'folletos-sin-estudio' }
    const code = (p.plan_code ?? '').toUpperCase()
    if (NIVELES.has(code) || p.plan_level === 'niveles') return { area: 'estudios', categoria: 'niveles' }
    if (DISCIPULOS.has(code)) return { area: 'estudios', categoria: 'discipulos' }
    return { area: 'estudios', categoria: 'capacitaciones' }
  }
  return { area: 'otro', categoria: 'otro' }
}

export const claveDeCategoria = (c: CategoriaDePago): string => `${c.area}:${c.categoria}`

export const ETIQUETA_DE_AREA: Readonly<Record<AreaDePago, string>> = {
  estudios: 'Estudios',
  eventos: 'Eventos',
  otro: 'Otros',
}

const ETIQUETA_ESTUDIOS: Readonly<Record<string, string>> = {
  niveles: 'Niveles',
  discipulos: 'Discípulos',
  capacitaciones: 'Capacitaciones',
  prematrimonial: 'Prematrimonial',
  'folletos-sin-estudio': 'Folletos sin estudio',
}

/**
 * «Estudios · Niveles», «Eventos · Sports». Para eventos recibe el nombre del
 * tipo (del catálogo); si no hay, cae al slug para no inventar.
 */
export function etiquetaDeCategoria(c: CategoriaDePago, nombreDeTipo?: (slug: string) => string): string {
  if (c.area === 'estudios') return `Estudios · ${ETIQUETA_ESTUDIOS[c.categoria] ?? c.categoria}`
  if (c.area === 'eventos') {
    const tipo = c.categoria === 'sin-tipo' ? 'Sin tipo' : (nombreDeTipo?.(c.categoria) ?? c.categoria)
    return `Eventos · ${tipo}`
  }
  return 'Otros'
}

/**
 * ¿Pasa el filtro? El valor del filtro es 'all', un área ('estudios') o una
 * clave completa ('eventos:sports').
 */
export function cumpleFiltroDeCategoria(c: CategoriaDePago, filtro: string): boolean {
  if (filtro === 'all') return true
  if (!filtro.includes(':')) return c.area === filtro
  return claveDeCategoria(c) === filtro
}

/**
 * La fecha por la que se reporta un pago: la de PAGO si está cancelado (es
 * cuándo entró la plata, lo que concilia finanzas — PAG-6), y la de creación
 * del cobro para lo pendiente, anulado o devuelto, que no tienen otra.
 * Devuelve 'YYYY-MM-DD' para comparar como string contra un input date.
 */
export function fechaDelPago(p: { status: string; paid_at: string | null; created_at: string }): string {
  const iso = p.status === 'paid' && p.paid_at ? p.paid_at : p.created_at
  return iso.slice(0, 10)
}

/** `desde`/`hasta` vacíos = sin tope por ese lado. */
export function enRango(ymd: string, desde: string, hasta: string): boolean {
  if (desde && ymd < desde) return false
  if (hasta && ymd > hasta) return false
  return true
}
