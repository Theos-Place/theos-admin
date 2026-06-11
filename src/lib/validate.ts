// Validaciones chicas compartidas por rutas API.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** true si el string es un UUID v4-like. Para validar ids de ruta antes de
 *  pasarlos a Postgres (un id malformado tira 22P02 → 500 ruidoso). */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
