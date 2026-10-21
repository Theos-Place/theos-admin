/**
 * SRV-20 (etapa 4B) · Filtros del padrón por el perfil S.I.R.V.E. y por
 * profesión.
 *
 * Pedido de Floriana (2026-10-21): «agregar al buscador de miembros búsquedas
 * por medio de los datos del perfil, por ejemplo buscar por dones o por
 * profesiones». Las cuatro de S.I.R.V.E. son de selección múltiple sobre el
 * catálogo (unión, como los filtros de dirigente); la profesión es texto
 * libre sobre `members.occupation`.
 *
 * LA PUERTA. El perfil S.I.R.V.E. lo lee solo quien dice `puedeLeerSirve`
 * (coordinación de estudios, servidores, staff y dirección). El padrón lo ve
 * más gente, y un filtro «tiene el don de profecía» es leer el perfil persona
 * por persona. Por eso la pantalla esconde el bloque Y el servidor rechaza la
 * consulta (403) en /api/members, /ids y /export — las tres que evalúan
 * condiciones. No se «sanean» quitando la condición en silencio: una lista
 * que ignora parte de su filtro se ensancha sola (ver FilterState en
 * types/filters.ts). La profesión NO está detrás de la puerta: es un dato de
 * Info Personal, visible en la ficha para quien ve el padrón.
 *
 * Módulo PURO, sin React ni Supabase.
 */
import type { FilterCondition } from '@/types/filters'

export const TIPOS_SIRVE = ['sirve_don', 'sirve_habilidad', 'sirve_pasion', 'sirve_estilo'] as const
export type TipoSirve = (typeof TIPOS_SIRVE)[number]

export function esCondicionSirve(c: { type: string }): boolean {
  return (TIPOS_SIRVE as readonly string[]).includes(c.type)
}

/** ¿Hay alguna condición que lea el perfil S.I.R.V.E.? Para la puerta de los endpoints. */
export function tieneCondicionesSirve(conditions: ReadonlyArray<{ type: string }> | undefined | null): boolean {
  return (conditions ?? []).some(esCondicionSirve)
}

/**
 * El patrón ILIKE para la profesión: «conta» encuentra «Contador público».
 * Los comodines del usuario se neutralizan (son texto, no sintaxis).
 */
export function patronDeProfesion(texto: string): string | null {
  const t = texto.trim().replace(/[%_\\]/g, m => `\\${m}`)
  return t ? `%${t}%` : null
}

/** Lo que dice el chip: «Dones: Fe, Enseñanza» o «Dones: 4 seleccionados». */
export function resumenDeValores(values: readonly string[], max = 2): string {
  if (values.length === 0) return 'ninguno'
  return values.length <= max ? values.join(', ') : `${values.length} seleccionados`
}

export const ETIQUETA_SIRVE: Record<TipoSirve, string> = {
  sirve_don: 'Dones',
  sirve_habilidad: 'Habilidades',
  sirve_pasion: 'Pasiones',
  sirve_estilo: 'Estilo',
}

export type CondicionSirve = Extract<FilterCondition, { type: TipoSirve }>
