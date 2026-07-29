// PAG-4: deep link a un acordeón del tab Participación del perfil
// (/miembros/[id]?tab=participacion&open=pagos). Regla pura y testeable:
// qué secciones deben arrancar abiertas según el query param `open`.

/** Claves de acordeón direccionables por URL (whitelist explícita: el param
 *  viene del usuario). */
const OPENABLE = new Set(['pagos', 'estudios', 'servicio', 'eventos', 'donaciones', 'misBecas'])

export function openSectionsFromParam(open: string | null | undefined): Record<string, boolean> {
  if (!open || !OPENABLE.has(open)) return {}
  return { [open]: true }
}
