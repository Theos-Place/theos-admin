'use client'

import { Tabs } from '@/components/shared/Tabs'

/** Tabs de las páginas de solicitudes (estudios, finanzas). Usa el componente
 *  Tabs compartido — misma línea de diseño que el resto de la app. */
export type RequestTab = { key: string; label: string }

export function RequestTabs({
  tabs, active, counts, onChange,
}: {
  tabs: RequestTab[]
  active: string
  /** Conteo por key (ej. solicitudes abiertas/en revisión del tipo). */
  counts?: Record<string, number>
  onChange: (key: string) => void
}) {
  return (
    <Tabs
      tabs={tabs.map(t => ({ ...t, count: counts?.[t.key] }))}
      active={active}
      onChange={onChange}
    />
  )
}
