/**
 * PAR-8 (2026-10-30) · Los filtros avanzados del padrón viven en la URL.
 *
 * La búsqueda y los chips ya iban en la URL (?q=, ?donantes=1…); las
 * condiciones avanzadas no, y al abrir un perfil y volver con «atrás» se
 * perdían: había que rearmarlas cada vez. Ahora viajan en `?f=` (JSON en
 * base64url), así el «atrás» restaura la búsqueda exacta, un refresh no pierde
 * nada y el enlace se puede compartir. Si el JSON es demasiado largo para una
 * URL razonable, va a sessionStorage y en la URL queda una clave corta (`?fk=`).
 *
 * Módulo PURO (salvo los dos helpers de sessionStorage, que toleran fallar).
 */
import type { FilterCondition, ConditionGroup } from '@/types/filters'

export type FiltrosAvanzados = {
  conditions: FilterCondition[]
  groups: ConditionGroup[]
  topLevelOps: Record<string, 'AND' | 'OR'>
}

/** Más largo que esto, la URL deja de ser cómoda de copiar y de pegar. */
export const MAX_LARGO_EN_URL = 1800
export const PREFIJO_SESION = 'theos_filtros_miembros_'
/** Dónde guarda /miembros su última URL, para el «Volver a los resultados» del perfil. */
export const CLAVE_ULTIMA_BUSQUEDA = 'theos_miembros_ultima_busqueda'

function aBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64Url(raw: string): string | null {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)))
  } catch {
    return null
  }
}

/** '' cuando no hay condiciones: la URL queda limpia. */
export function codificarFiltros(f: FiltrosAvanzados): string {
  if (f.conditions.length === 0) return ''
  return aBase64Url(JSON.stringify({ c: f.conditions, g: f.groups, o: f.topLevelOps }))
}

/**
 * Lo inverso, defensivo: una URL vieja, recortada o tocada a mano no puede
 * romper la pantalla. Lo que no tenga forma de filtros devuelve null y la
 * pantalla arranca sin filtros avanzados.
 */
export function decodificarFiltros(raw: string | null | undefined): FiltrosAvanzados | null {
  if (!raw) return null
  const json = deBase64Url(raw)
  if (!json) return null
  let d: unknown
  try { d = JSON.parse(json) } catch { return null }
  if (!d || typeof d !== 'object') return null
  const { c, g, o } = d as { c?: unknown; g?: unknown; o?: unknown }
  if (!Array.isArray(c) || c.length === 0) return null
  if (!c.every(x => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'number' && typeof (x as { type?: unknown }).type === 'string')) return null
  const groups = Array.isArray(g)
    ? g.filter(x => x && typeof x === 'object' && typeof (x as ConditionGroup).id === 'number' && Array.isArray((x as ConditionGroup).members)) as ConditionGroup[]
    : []
  const ops: Record<string, 'AND' | 'OR'> = {}
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) if (v === 'AND' || v === 'OR') ops[k] = v
  }
  return { conditions: c as FilterCondition[], groups, topLevelOps: ops }
}

/** El siguiente id libre: los nuevos no pueden chocar con los que vinieron de la URL. */
export function siguienteId(f: FiltrosAvanzados | null): number {
  if (!f) return 1
  const ids = [...f.conditions.map(c => c.id), ...f.groups.map(g => g.id)]
  return ids.length ? Math.max(...ids) + 1 : 1
}

/** Clave corta y estable para el respaldo en sessionStorage. */
export function claveCorta(texto: string): string {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export type ParametrosDeFiltros = { f: string; fk: string }

/** Qué va a la URL: `f` con el JSON, o `fk` con la clave si es muy largo. */
export function parametrosParaLaUrl(codificado: string): ParametrosDeFiltros & { guardarEnSesion: string | null } {
  if (!codificado) return { f: '', fk: '', guardarEnSesion: null }
  if (codificado.length <= MAX_LARGO_EN_URL) return { f: codificado, fk: '', guardarEnSesion: null }
  return { f: '', fk: claveCorta(codificado), guardarEnSesion: codificado }
}

/** Lee los filtros desde los parámetros, buscando en la sesión si vino `fk`. */
export function leerFiltros(p: ParametrosDeFiltros, sesion: (k: string) => string | null): FiltrosAvanzados | null {
  if (p.f) return decodificarFiltros(p.f)
  if (p.fk) return decodificarFiltros(sesion(PREFIJO_SESION + p.fk))
  return null
}

export function leerDeSesion(k: string): string | null {
  try { return sessionStorage.getItem(k) } catch { return null }
}
export function guardarEnSesion(k: string, v: string): void {
  try { sessionStorage.setItem(k, v) } catch { /* modo privado: queda solo en la URL corta */ }
}
