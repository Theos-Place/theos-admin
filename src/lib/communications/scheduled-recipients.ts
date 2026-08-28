// Qué destinatarios usa un comunicado programado al llegar su hora (módulo puro).
//
// La consulta vive en queries/communications.ts; acá está la decisión, que es
// lo que conviene tener fijado con tests.

export type Congelado = { member_id: string | null; channel: 'whatsapp' | 'email' | 'interna' }

/**
 * Un comunicado programado se arma hoy y sale dentro de días o semanas.
 *
 * Si salió de una lista guardada, la LISTA manda sobre la foto congelada: una
 * invitación a "los que no han llevado Nivel 1" no le tiene que llegar a quien
 * lo llevó en el medio, y sí a quien entró al criterio después.
 *
 * La foto es el respaldo. Se usa cuando no hay lista, cuando la lista no se
 * pudo recalcular (filtro incompleto) o cuando el recálculo devolvió vacío —
 * mandar a la foto vieja es peor que mandar bien, pero mucho mejor que no
 * mandarle a nadie sin que nadie se entere.
 */
export function destinatariosDelEnvio(
  congelados: Congelado[],
  recalculados: string[] | null,
): { ids: string[]; fuente: 'lista' | 'foto'; canal: Congelado['channel'] } {
  const canal = congelados[0]?.channel ?? 'email'
  if (recalculados && recalculados.length > 0) {
    return { ids: recalculados, fuente: 'lista', canal }
  }
  return {
    ids: congelados.map(c => c.member_id).filter((x): x is string => !!x),
    fuente: 'foto', canal,
  }
}
