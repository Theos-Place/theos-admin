// PAR-9 · Editar una lista guardada (módulo puro).
//
// Diagnóstico del 2026-10-30, en producción: 17 listas. 13 tienen el filtro
// COMPLETO (`v: 2`) y se pueden volver a abrir en Miembros con sus condiciones;
// 4 son FIJAS —las importadas de Excel o armadas a mano, como «Servidores
// comprometidos Campa 2026»— y no tienen filtro: su contenido es la única
// definición que tienen. A esas no se les edita un filtro que no existe: se
// les agregan o quitan personas.
//
// La consulta y las escrituras viven en queries/member-lists.ts y en la ruta;
// acá queda lo que se decide sin tocar la base.

import type { FilterState } from '@/types/filters'
import type { RoleId } from '@/types/auth'
import { codificarFiltros, parametrosParaLaUrl, PREFIJO_SESION } from './filtros-en-url'
import { motivoNoRecalculable } from './list-refresh'

/** Los roles que hoy gestionan listas (los mismos que pueden crearlas). */
export const ROLES_QUE_GESTIONAN_LISTAS: RoleId[] = ['comunicaciones', 'direccion', 'editor_perfiles', 'coordinador_estudios']

/**
 * ¿Tiene un filtro que se pueda volver a abrir y editar? Es la misma regla que
 * decide si se puede recalcular: un filtro incompleto (anterior a `v: 2`)
 * reabierto en Miembros daría otra búsqueda, más ancha que la original.
 */
export function tieneFiltroEditable(f: FilterState | null | undefined): boolean {
  return motivoNoRecalculable(f) === null
}

/**
 * La URL de /miembros con la búsqueda EXACTA de la lista: condiciones (`f`, o
 * `fk` con respaldo en la sesión si son muy largas, como PAR-8), chips,
 * búsqueda, y `lista` para que la pantalla sepa que está editando esa lista.
 */
export function enlaceParaEditarFiltros(listId: string, f: FilterState): {
  href: string
  /** Si las condiciones no caben en la URL: guardar esto en sessionStorage antes de navegar. */
  sesion: { clave: string; valor: string } | null
} {
  const p = parametrosParaLaUrl(codificarFiltros({
    conditions: f.conditions ?? [], groups: f.groups ?? [], topLevelOps: f.topLevelOps ?? {},
  }))
  const u = new URLSearchParams()
  if (p.f) u.set('f', p.f)
  if (p.fk) u.set('fk', p.fk)
  if (f.is_donor) u.set('donantes', '1')
  if (f.is_server) u.set('servidores', '1')
  if (f.active_attendance === 'estudios') u.set('asistencia_estudios', '1')
  else if (f.active_attendance) u.set('activos', '1')
  const q = (f.search ?? '').trim()
  if (q) u.set('q', q)
  u.set('lista', listId)
  return {
    href: `/miembros?${u.toString()}`,
    sesion: p.guardarEnSesion ? { clave: PREFIJO_SESION + p.fk, valor: p.guardarEnSesion } : null,
  }
}

/**
 * Quién puede editar una lista: los roles que gestionan listas y, además,
 * quien la creó. Hasta el 30-oct-2026 `created_by` no se guardaba (las 17
 * listas lo tienen vacío), así que en las viejas cuentan solo los roles.
 */
export function puedeEditarLista(
  ctx: { roles: readonly string[]; memberId: string | null },
  lista: { created_by: string | null },
): boolean {
  if (ctx.roles.includes('admin')) return true
  if (ROLES_QUE_GESTIONAN_LISTAS.some(r => ctx.roles.includes(r))) return true
  return !!ctx.memberId && !!lista.created_by && lista.created_by === ctx.memberId
}

/** Un comunicado PROGRAMADO que sale a esta lista: el cron la recalcula al
 *  enviarlo, así que cambiarle el filtro cambia a quién le llega. */
export type EnvioQueUsaLaLista = { id: string; subject: string | null; channel: string; scheduled_at: string | null }

/**
 * El aviso antes de guardar, o null si nada programado la usa.
 * `fecha` formatea el instante (se inyecta para que esto siga siendo puro).
 */
export function avisoDeImpacto(envios: readonly EnvioQueUsaLaLista[], fecha: (iso: string) => string): string | null {
  if (envios.length === 0) return null
  const uno = (e: EnvioQueUsaLaLista) =>
    `«${e.subject?.trim() || 'Comunicado sin asunto'}» programado para el ${e.scheduled_at ? fecha(e.scheduled_at) : '—'}`
  const lista = envios.length === 1 ? uno(envios[0]) : envios.map(uno).join('; ')
  return `Esta lista se usa en ${envios.length === 1 ? 'un comunicado' : `${envios.length} comunicados`}: ${lista}. `
    + 'El cambio afecta a quién le llega.'
}

/**
 * Agregar o quitar personas de una lista FIJA. Conserva el orden, no duplica,
 * y quitar a alguien que no estaba no es error.
 */
export function aplicarCambioDePersonas(
  actuales: readonly string[], accion: 'agregar_personas' | 'quitar_personas', ids: readonly string[],
): { member_ids: string[]; agregados: string[]; quitados: string[] } {
  if (accion === 'agregar_personas') {
    const ya = new Set(actuales)
    const agregados = [...new Set(ids)].filter(id => !ya.has(id))
    return { member_ids: [...actuales, ...agregados], agregados, quitados: [] }
  }
  const fuera = new Set(ids)
  const quitados = actuales.filter(id => fuera.has(id))
  return { member_ids: actuales.filter(id => !fuera.has(id)), agregados: [], quitados }
}
