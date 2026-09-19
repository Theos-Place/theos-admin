/**
 * SRV-4 · Qué comités puede mirar quien pide "Mi comité".
 *
 * Módulo PURO para poder probar el recorte sin levantar la ruta. La lista de
 * comités propios sale de la estrella de SRV-5 (`getManageableCommitteeIds`),
 * nunca de lo que mande la UI: pedir el id de otro comité tiene que dar 403
 * aunque ese comité exista y aunque el menú no lo ofrezca.
 */
export type AlcanceDeMiComite =
  | { ok: true; comites: string[] }
  | { ok: false; motivo: 'ajeno' }

export function comitesAConsultar(
  propios: readonly string[],
  pedido: string | null | undefined,
): AlcanceDeMiComite {
  if (!pedido) return { ok: true, comites: [...propios] }
  if (!propios.includes(pedido)) return { ok: false, motivo: 'ajeno' }
  return { ok: true, comites: [pedido] }
}
