/**
 * DIR-8 · Quién puede ver y escribir las notas del dirigente.
 *
 * Las notas hablan de personas: por qué alguien no aprobó el CDEB, por qué
 * se le da seguimiento, por qué está en pausa. No son datos operativos.
 *
 * LA LISTA ES CORTA A PROPÓSITO, y se nombran roles en vez de heredar
 * privilegio — el mismo criterio de DIR-5 y DIR-6:
 *
 *  · ESCRIBE: coordinación de dirigentes (Fabiola). Nadie más.
 *  · LEE: además, `lector_dirigentes` (Luis y Yeya).
 *  · NO: `editor_dirigentes` (Andrés, Diego, Wilber). Actualizan datos del
 *    dirigente todos los días y NO ven las notas. Es la distinción que
 *    justifica que existan dos roles.
 *  · NO: `direccion` ni `coordinador_estudios`, aunque tengan el módulo
 *    completo. Decisión explícita de Floriana el 2026-10-12: exclusivo por
 *    ahora, se amplía si hace falta.
 *  · NUNCA: el dirigente, sobre sí mismo. No hay excepción de «es mi dato».
 *
 * `admin` sí, porque es quien repara cuando algo se rompe.
 *
 * Módulo PURO.
 */
import type { RoleId } from '@/types/auth'

export const ROLES_QUE_ESCRIBEN_NOTAS: readonly RoleId[] = ['coordinador_dirigentes', 'admin']
export const ROLES_QUE_LEEN_NOTAS: readonly RoleId[] = [
  ...ROLES_QUE_ESCRIBEN_NOTAS,
  'lector_dirigentes',
]

export function puedeLeerNotas(roles: readonly string[] | null | undefined): boolean {
  return (roles ?? []).some(r => (ROLES_QUE_LEEN_NOTAS as readonly string[]).includes(r))
}

export function puedeEscribirNotas(roles: readonly string[] | null | undefined): boolean {
  return (roles ?? []).some(r => (ROLES_QUE_ESCRIBEN_NOTAS as readonly string[]).includes(r))
}

/** Los campos que NO pueden viajar a quien no puede leerlos. */
export const CAMPOS_DE_NOTA = [
  'nota_revision', 'nota_cdeb', 'nota_decision_propia', 'nota_pausa', 'nota_general',
] as const
export type CampoDeNota = (typeof CAMPOS_DE_NOTA)[number]

/**
 * Quita las notas del objeto si quien mira no puede leerlas.
 *
 * Se SANEA EL PAYLOAD y no solo la pantalla: un campo que llega al navegador
 * es visible aunque no se pinte, y acá el campo dice por qué alguien está en
 * revisión. Mismo patrón que `visibleLeaderStatus` de DIR-6.
 */
export function sinNotas<T extends object>(
  fila: T,
  roles: readonly string[] | null | undefined,
): T {
  if (puedeLeerNotas(roles)) return fila
  const limpio = { ...fila } as Record<string, unknown>
  for (const c of CAMPOS_DE_NOTA) delete limpio[c]
  return limpio as T
}

/**
 * Lo mismo, y además sin la BANDERITA.
 *
 * Se QUITA la llave en vez de mandarla vacía: un `revision: []` diría «esta
 * persona no tiene ninguna», que no es lo mismo que «no te toca verlo», y
 * quien lea el payload no puede distinguirlos.
 */
export function sinNotasNiBanderita<T extends object>(
  fila: T,
  roles: readonly string[] | null | undefined,
): T {
  if (puedeVerBanderita(roles)) return fila
  const limpio = { ...sinNotas(fila, roles) } as Record<string, unknown>
  delete limpio.revision
  return limpio as T
}

/**
 * ¿Puede este observador ver la BANDERITA de revisión?
 *
 * La banderita dice que hay una situación abierta con una persona, así que
 * va con las notas y no con el estado. Quien no puede verla recibe la ficha
 * sin ella, no una ficha que dice «sin banderitas» — eso sería mentir.
 */
export function puedeVerBanderita(roles: readonly string[] | null | undefined): boolean {
  return puedeLeerNotas(roles)
}
