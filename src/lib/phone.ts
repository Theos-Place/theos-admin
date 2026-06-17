/**
 * Normalización de teléfonos: SOLO dígitos. Usada en limpieza de datos,
 * formularios (crear/editar miembro) e imports, para que la BD nunca vuelva a
 * tener guiones/espacios/paréntesis. Módulo puro (sin React) para reutilizar en scripts.
 */
export function normalizePhone(value: string | null | undefined): string {
  if (value == null) return ''
  return String(value).replace(/\D+/g, '')
}

/** Igual que normalizePhone pero devuelve null si queda vacío (para columnas nullable). */
export function normalizePhoneOrNull(value: string | null | undefined): string | null {
  const cleaned = normalizePhone(value)
  return cleaned.length > 0 ? cleaned : null
}
