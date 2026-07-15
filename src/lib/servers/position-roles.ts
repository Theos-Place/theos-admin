// Mapeo puesto → rol automático (módulo PURO, sin server). Fuente única de
// verdad: qué puestos de servicio otorgan qué rol del sistema al ocupante.
// Extensible: agregar una regla nueva a POSITION_ROLE_RULES sin tocar el resto
// del sistema (asignar/remover, migración de datos y sync ya son genéricos).
import type { RoleId } from '@/types/auth'

export type PositionContext = {
  title: string
  areaName: string
  areaType: 'area' | 'committee'
  /** Nombre del área padre (null si el área/comité es de nivel raíz). */
  parentAreaName: string | null
}

export type PositionRoleRule = {
  role: RoleId
  /** Explica la regla en la UI de auditoría/reporte. */
  description: string
  matches: (ctx: PositionContext) => boolean
}

/** minúsculas, sin acentos, espacios recortados — para comparar títulos con
 *  variantes de escritura ("Colaborador Bienvenida" / "Colaborador de Bienvenida"). */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

/** Puestos de check-in/bienvenida en las sedes (comités "Sede X" bajo el área
 *  "Área Espiritual"). Confirmado 2026-07-15 contra el catálogo real (los
 *  títulos no incluyen "encargado de"/"mesa de info" literal). */
const SEDE_EVENTOS_TITLES = new Set([
  'logistica',
  'colaborador bienvenida',
  'colaborador de bienvenida',
  'coordinador bienvenida',
  'coordinador informacion',
])

export const POSITION_ROLE_RULES: PositionRoleRule[] = [
  {
    role: 'encargado_eventos',
    description:
      'Puestos de logística/bienvenida/información en los comités de sede (Área Espiritual): ' +
      'Logística, Colaborador/Coordinador Bienvenida, Coordinador Información.',
    matches: (ctx) =>
      ctx.areaType === 'committee' &&
      norm(ctx.parentAreaName ?? '') === 'area espiritual' &&
      SEDE_EVENTOS_TITLES.has(norm(ctx.title)),
  },
  {
    role: 'lider_comite',
    description:
      'Encargado de cualquier comité (título "Encargado" o "Encargado de comité"), de cualquier área. ' +
      'Excluye asistentes/sub-roles ("Asistente Encargado", "Encargado GR", etc.).',
    matches: (ctx) =>
      ctx.areaType === 'committee' &&
      (norm(ctx.title) === 'encargado' || norm(ctx.title) === 'encargado de comite'),
  },
]

/** Roles que otorga un puesto dado su contexto (puede ser más de uno si varias
 *  reglas matchean). [] si el puesto no otorga ningún rol automático. */
export function rolesGrantedByPosition(ctx: PositionContext): RoleId[] {
  return POSITION_ROLE_RULES.filter(r => r.matches(ctx)).map(r => r.role)
}
