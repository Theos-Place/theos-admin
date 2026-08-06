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

/** Código de país por defecto: los teléfonos del padrón se guardan sin él y
 *  casi todos son de Costa Rica (8 dígitos). */
export const DEFAULT_COUNTRY_CODE = '506'

/** Enlace de WhatsApp (wa.me) a partir de un teléfono guardado.
 *  Un número local de 8 dígitos se prefija con 506; uno que ya trae código de
 *  país (más de 8 dígitos) se deja como está. */
export function waLink(value: string | null | undefined): string {
  const d = normalizePhone(value)
  if (!d) return '#'
  const conPais = d.length <= 8 ? `${DEFAULT_COUNTRY_CODE}${d}` : d
  return `https://wa.me/${conPais}`
}
