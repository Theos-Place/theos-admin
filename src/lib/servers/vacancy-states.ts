/**
 * SRV-15 · El ciclo de una solicitud de puestos de servicio.
 *
 * NADA SE PUBLICA SOLO. Es la corrección de SRV-12, donde una solicitud hecha
 * por un rol administrativo entraba ya aprobada —o sea publicada sin que nadie
 * apretara nada—. Ahora TODA solicitud entra en `lista_para_publicar`, la pida
 * quien la pida, y solo «Publicar puestos» la mueve.
 *
 * TRES ESTADOS DEL CICLO, que son los tres que alguien puede señalar en la
 * pantalla y explicar en una frase:
 *
 *   lista_para_publicar → la pidió un comité y espera la publicación del mes.
 *   publicada           → está en la página pública y recibe aplicaciones.
 *   despublicada        → la bajó la publicación siguiente, o una persona.
 *                         Conserva sus aplicaciones: bajarla no las borra.
 *
 * `denegado` no es parte del ciclo pero existe: negar una solicitud es un
 * desenlace real y DISTINTO de bajarla —una negada nunca estuvo publicada—, y
 * sin él quien la rechaza no tendría dónde dejarlo dicho.
 *
 * EL VOCABULARIO VIEJO se unificó en la migración `20260926090000`:
 * 'creado' y 'enviado_lider' → `lista_para_publicar`, 'aprobado' →
 * `publicada`, 'cerrada' → `despublicada`. Ese último era la misma cosa con
 * otro nombre: «dejó de aceptar aplicaciones» y «ya no está publicada» son el
 * mismo hecho, y tener los dos obligaba a preguntarse cuál usar.
 *
 * Módulo PURO — cliente y servidor.
 */

export const VACANCY_STATES = [
  'lista_para_publicar', 'publicada', 'despublicada', 'denegado',
] as const
export type VacancyState = (typeof VACANCY_STATES)[number]

/** El estado con el que entra TODA solicitud. */
export const ESTADO_INICIAL: VacancyState = 'lista_para_publicar'

export const VACANCY_STATE_LABEL: Record<VacancyState, string> = {
  lista_para_publicar: 'Lista para publicar',
  publicada: 'Publicada',
  despublicada: 'Despublicada',
  denegado: 'Denegada',
}

/** Qué significa cada uno. Va junto a la etiqueta porque «lista para
 *  publicar» y «publicada» se parecen en el texto y no en las consecuencias:
 *  solo la segunda se ve desde afuera. */
export const VACANCY_STATE_HELP: Record<VacancyState, string> = {
  lista_para_publicar: 'La pidió un comité y espera la publicación del mes.',
  publicada: 'Está en la página pública y puede recibir aplicaciones.',
  despublicada: 'Ya no está en la página. Sus aplicaciones se conservan.',
  denegado: 'No se va a publicar.',
}

/** Clases de badge (paleta navy/coral/teal del sistema). */
export const VACANCY_STATE_BADGE: Record<VacancyState, string> = {
  lista_para_publicar: 'bg-[rgba(233,185,73,0.15)] text-[#A8821F]',
  publicada: 'bg-success/12 text-success',
  despublicada: 'bg-navy/10 text-navy',
  denegado: 'bg-coral/10 text-coral-deep',
}

export function isVacancyState(v: string): v is VacancyState {
  return (VACANCY_STATES as readonly string[]).includes(v)
}
