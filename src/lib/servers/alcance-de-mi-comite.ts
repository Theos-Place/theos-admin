/**
 * SRV-4 / SRV-6 · Qué comités puede mirar quien pide "Mi comité".
 *
 * Módulo PURO para poder probar el recorte sin levantar la ruta. Dos audiencias
 * con reglas distintas:
 *
 *  - El ENCARGADO ve los suyos y nada más. La lista sale de la estrella de
 *    SRV-5 (`getManageableCommitteeIds`), nunca de lo que mande la UI: pedir el
 *    id de otro comité da 403 aunque ese comité exista y aunque el menú no lo
 *    ofrezca.
 *  - Los roles AMPLIOS (staff, coordinación de servidores, dirección, admin)
 *    eligen cualquiera con el selector, y ven exactamente lo mismo que vería su
 *    encargado (SRV-6, decisión del usuario 2026-09-21).
 */
export type QuienPregunta = {
  /** Comités donde es encargado. */
  propios: readonly string[]
  /** ¿Tiene un rol que le deja elegir cualquier comité? */
  amplio: boolean
}

export type AlcanceDeMiComite =
  | { ok: true; comites: string[] }
  | { ok: false; motivo: 'ajeno' }

export function comitesAConsultar(
  quien: QuienPregunta,
  pedido: string | null | undefined,
): AlcanceDeMiComite {
  // Sin comité pedido se muestran los propios. Para un rol amplio que no es
  // encargado de nada eso es vacío, y está bien: que elija en el selector.
  // Cargar los 46 comités "por si acaso" sería casi un minuto de consultas
  // para una pantalla que mira uno a la vez.
  if (!pedido) return { ok: true, comites: [...quien.propios] }
  if (quien.amplio) return { ok: true, comites: [pedido] }
  if (!quien.propios.includes(pedido)) return { ok: false, motivo: 'ajeno' }
  return { ok: true, comites: [pedido] }
}
