// EST-4: un grupo virtual lleva SIEMPRE la zona fija "Virtual" (sede code
// 'VIRTUAL', seed 20260727170000, inactiva para no aparecer en combos de
// charlas). Módulo puro — lo usan los forms de crear y editar grupo.

import type { ComboValue } from '@/components/shared/Combobox'

export const VIRTUAL_ZONE_CODE = 'VIRTUAL'
export const VIRTUAL_ZONE_LABEL = 'Virtual'

export function virtualZoneValue(): ComboValue {
  return { kind: 'existing', value: VIRTUAL_ZONE_CODE, label: VIRTUAL_ZONE_LABEL }
}

export function isVirtualZone(v: ComboValue): boolean {
  return v.kind === 'existing' && v.value === VIRTUAL_ZONE_CODE
}

/** Zona efectiva al togglear el checkbox "Grupo virtual": marcar fija la zona
 *  Virtual; desmarcar limpia SOLO si la zona era Virtual (una zona elegida a
 *  mano no se pisa). `cleared` es el default de cada form (p. ej. "Todas las
 *  zonas" en crear, vacío en editar). */
export function zoneOnVirtualToggle(isVirtual: boolean, current: ComboValue, cleared: ComboValue): ComboValue {
  if (isVirtual) return virtualZoneValue()
  return isVirtualZone(current) ? cleared : current
}
