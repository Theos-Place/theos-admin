import type { ComboValue } from '@/components/shared/Combobox'

/**
 * Resuelve la selección de zona del combobox a un `code` de sede para guardar en
 * el grupo. Si es una zona NUEVA, la crea en el catálogo (POST /api/sedes hace el
 * dedup por nombre normalizado, así que dos "Norte" no duplican) y devuelve su code.
 * Devuelve null si no se eligió zona.
 *
 * Se crea ANTES de guardar el grupo; si el guardado del grupo falla luego, la zona
 * queda en el catálogo (es un registro válido y reutilizable, no basura).
 */
export async function resolveZoneCode(v: ComboValue): Promise<string | null> {
  if (v.kind === 'empty') return null
  if (v.kind === 'existing') return v.value
  const res = await fetch('/api/sedes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: v.label }),
  })
  if (!res.ok) {
    const b = await res.json().catch(() => null)
    throw new Error(b?.error || 'No se pudo crear la zona')
  }
  const sede = (await res.json()) as { id: string }
  return sede.id
}
