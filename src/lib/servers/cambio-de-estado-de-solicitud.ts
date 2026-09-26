/**
 * SRV-15b · Mover una solicitud de puesto a mano.
 *
 * POR QUÉ HACE FALTA. El ciclo normal lo mueve «Publicar puestos» una vez al
 * mes, y eso cubre el caso feliz. Lo que no cubría: una publicada que hay que
 * bajar antes de fin de mes porque el comité ya la llenó, y —el pedido que
 * originó esto— una que se denegó o se bajó y que después sí se quiere
 * publicar. Sin una forma de devolverla, el único camino era pedirla de nuevo
 * y perder de quién era y desde cuándo.
 *
 * LA REGLA QUE NO SE TOCA: `publicada` NO ES UN DESTINO A MANO. Publicar es lo
 * que hace la corrida del mes, que además sella `published_at`; una fila
 * puesta en `publicada` por otra puerta quedaría sin esa fecha, y
 * `planDePublicacion` trata a la publicada sin fecha como vieja y la baja en
 * la corrida siguiente. O sea que el atajo no solo salta el ciclo: sale a la
 * calle y se cae sola. Para poner algo en la calle se devuelve a
 * `lista_para_publicar` y se publica.
 *
 * DE `publicada` NO SE VUELVE DIRECTO A LA COLA, hay que bajarla primero. No
 * es trámite: mientras esté publicada, la gente la está viendo y puede
 * aplicar. Devolverla a la cola sin bajarla dejaría una fila que dice «espera
 * publicación» y que está publicada al mismo tiempo — y la corrida del mes la
 * publicaría de nuevo, encima de sí misma.
 *
 * Módulo PURO — la ruta valida con esto y la pantalla dibuja con esto, para
 * que no haya dos listas de lo que se puede hacer.
 */

import { type VacancyState, VACANCY_STATE_LABEL } from './vacancy-states'

/** A dónde puede mover una persona una solicitud, según dónde está. */
export const TRANSICIONES_A_MANO: Record<VacancyState, readonly VacancyState[]> = {
  lista_para_publicar: ['denegado'],
  publicada: ['despublicada'],
  despublicada: ['lista_para_publicar', 'denegado'],
  denegado: ['lista_para_publicar'],
}

export function estadosDestinoAMano(desde: string): readonly VacancyState[] {
  return TRANSICIONES_A_MANO[desde as VacancyState] ?? []
}

/**
 * El botón se nombra por lo que HACE, no por el estado al que lleva:
 * «Denegar» se entiende y «Pasar a denegada» hay que traducirlo.
 */
export const ACCION_HACIA: Record<VacancyState, string> = {
  lista_para_publicar: 'Devolver a la cola',
  publicada: 'Publicar',
  despublicada: 'Bajar de la página',
  denegado: 'Denegar',
}

/** Qué pasa si se aprieta. Va debajo de la acción porque «bajar» y «denegar»
 *  suenan parecido y no lo son: una estuvo publicada y la otra nunca. */
export const CONSECUENCIA_HACIA: Record<VacancyState, string> = {
  lista_para_publicar: 'Entra en la próxima publicación del mes.',
  publicada: '',
  despublicada: 'Sale de la página pública. Sus aplicaciones se conservan.',
  denegado: 'No se va a publicar. Se puede devolver después.',
}

/** `null` = se puede. Si no, el texto que se le muestra a quien lo intentó. */
export function motivoQueImpideCambiar(desde: string, hacia: string): string | null {
  if (desde === hacia) return 'La solicitud ya está en ese estado.'
  if (hacia === 'publicada') {
    return 'Una solicitud no se publica a mano: se devuelve a la cola y sale con '
      + '«Publicar puestos».'
  }
  if (estadosDestinoAMano(desde).includes(hacia as VacancyState)) return null
  const nombre = VACANCY_STATE_LABEL[desde as VacancyState]
  if (!nombre) return 'La solicitud está en un estado que este sistema no reconoce.'
  if (desde === 'publicada') {
    return 'Está publicada. Primero hay que bajarla de la página.'
  }
  return `No se puede pasar de «${nombre}» a ese estado.`
}
