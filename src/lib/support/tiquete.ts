/**
 * SOP-1 · Tiquetes de soporte: las reglas que no dependen de la BD.
 *
 * El tiquete nace en la puerta —quien atiende la mesa de información en un
 * evento— y lo resuelve el rol `soporte_tecnico`. Es SIMPLE a propósito: tres
 * cosas (quién, cuándo, qué pasó) y nada más. Sin categorías ni adjuntos,
 * decidido en la reunión del 2026-09-30: lo que llega es «cambiar un correo»,
 * «unir dos familias», «no me deja entrar», y para eso un texto alcanza.
 *
 * Módulo PURO.
 */

import type { RoleId } from '@/types/auth'
import { hasModulePermission } from '@/lib/auth/roles'

export type EstadoDeTiquete = 'open' | 'in_review' | 'resolved' | 'rejected'

export const ESTADOS_DE_TIQUETE: readonly EstadoDeTiquete[] = ['open', 'in_review', 'resolved', 'rejected']

/** Lo que RequestBoard recibe como `tabs`/`typeLabel`: un solo tipo. */
export const TIPO_DE_TIQUETE = 'support'
export const TABS_DE_SOPORTE = [{ key: TIPO_DE_TIQUETE, label: 'Soporte' }]
export const ETIQUETA_DE_TIPO: Record<string, string> = { [TIPO_DE_TIQUETE]: 'Soporte' }

/**
 * Mínimo de texto. Diez caracteres no es un umbral de calidad, es un filtro
 * contra el tiquete vacío o el «hola» mandado por error desde el celular: con
 * menos que eso soporte no tiene con qué trabajar y escribe de vuelta a
 * preguntar, que es justo lo que el tiquete evita.
 */
export const MINIMO_DE_DETALLE = 10
export const MAXIMO_DE_DETALLE = 4000

export function motivoQueImpideCrear(detalle: string): string | null {
  const t = detalle.trim()
  if (t.length < MINIMO_DE_DETALLE) return `Contá qué pasó con un poco más de detalle (mínimo ${MINIMO_DE_DETALLE} caracteres).`
  if (t.length > MAXIMO_DE_DETALLE) return `El detalle es muy largo (máximo ${MAXIMO_DE_DETALLE} caracteres).`
  return null
}

/**
 * ¿Quién puede LEVANTAR un tiquete? Los mismos que operan el check-in, ni uno
 * más: la pantalla de check-in ya pide `eventos:edit` (encargado_eventos por su
 * puesto de bienvenida/información, dirección, admin). Se pregunta por el
 * MISMO permiso y no por una lista aparte, para que no se desalineen.
 */
export function puedeLevantarTiquete(roles: readonly RoleId[]): boolean {
  return hasModulePermission(roles as RoleId[], 'eventos', 'edit')
}

/** ¿Quién puede VER y RESOLVER la cola? Solo soporte (y admin, que pasa siempre). */
export const SOPORTE_ROLES: readonly RoleId[] = ['soporte_tecnico', 'admin']

export function puedeResolverTiquetes(roles: readonly RoleId[]): boolean {
  return SOPORTE_ROLES.some(r => roles.includes(r))
}

/** Las acciones del tablero y a qué estado llevan. */
export const ACCION_A_ESTADO: Readonly<Record<'take' | 'resolve' | 'reject', EstadoDeTiquete>> = {
  take: 'in_review',
  resolve: 'resolved',
  reject: 'rejected',
}

/**
 * ¿Se puede pasar de `de` a `a`? Un tiquete cerrado no se reabre desde el
 * tablero: si el problema sigue, la puerta levanta otro y queda el rastro de
 * que el primero se dio por resuelto. Tomar uno que ya está en revisión se
 * permite (lo toma otra persona), y resolver/rechazar directo desde `open`
 * también: obligar a «tomar» primero es un clic que nadie pidió.
 */
export function puedeMover(de: EstadoDeTiquete, a: EstadoDeTiquete): boolean {
  if (de === 'resolved' || de === 'rejected') return false
  if (a === 'open') return false
  return true
}

export const MOTIVO_CERRADO = 'Este tiquete ya está cerrado. Si el problema sigue, levantá uno nuevo desde el check-in.'
