/**
 * DIR-14 · Qué estado se le muestra a un dirigente en la lista.
 *
 * QUÉ ESTABA MAL (visto el 2026-10-14). La pantalla mostraba DOS conteos que
 * no coincidían: el encabezado decía «210 activos · 375 inactivos» y los
 * chips del filtro decían «Activo 333 · Inactivo 245». Las dos cifras eran
 * ciertas y medían cosas distintas:
 *
 *  · El encabezado y el badge de cada fila usaban `d.status`, que es
 *    DERIVADO: «está en el comité activo o tiene un grupo abierto ahora».
 *  · Los chips usaban `estado_base`, el estado ADMINISTRATIVO que coordinación
 *    mantiene a mano desde DIR-8.
 *
 * La consecuencia no era solo un número raro: al filtrar por «Activo» salían
 * filas con el badge «Inactivo», porque cada uno respondía a otra pregunta.
 *
 * MANDA EL ADMINISTRATIVO. Es el que coordinación cura, el que la ficha edita
 * y el que los filtros ya usaban; el derivado sigue existiendo pero con su
 * propio nombre («Dando ahora»), que es lo que de verdad significa.
 *
 * Y APARECE UN TERCER GRUPO que antes se escondía: los que están en la lista
 * sin ficha de dirigente. El derivado los llamaba «Inactivo» —una afirmación
 * que nadie hizo— y los chips no los contaban, así que los dos números ni
 * siquiera sumaban el total de la lista. Ahora se dicen aparte.
 *
 * Módulo PURO.
 */

export type EstadoMostrado = 'activo' | 'inactivo' | 'sin_ficha'

export const ETIQUETA_MOSTRADA: Readonly<Record<EstadoMostrado, string>> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  sin_ficha: 'Sin ficha',
}

/**
 * `sin_ficha` no es un estado que alguien eligió: es que esta persona llegó a
 * la lista por otro camino (lidera un grupo, está en el comité) y nunca se le
 * abrió ficha de dirigente. Decirlo es lo útil —hay que abrírsela—; llamarla
 * «inactiva» es inventar una decisión.
 */
export const estadoMostrado = (estadoBase: string | null | undefined): EstadoMostrado =>
  estadoBase === 'activo' ? 'activo' : estadoBase === 'inactivo' ? 'inactivo' : 'sin_ficha'

export type ConteoDeEstados = {
  activos: number
  inactivos: number
  sinFicha: number
  total: number
}

/** Los tres conteos. Suman SIEMPRE el total de la lista, que es el punto. */
export function conteoDeEstados(
  dirigentes: readonly { estado_base?: string | null }[],
): ConteoDeEstados {
  const c: ConteoDeEstados = { activos: 0, inactivos: 0, sinFicha: 0, total: dirigentes.length }
  for (const d of dirigentes) {
    const e = estadoMostrado(d.estado_base)
    if (e === 'activo') c.activos++
    else if (e === 'inactivo') c.inactivos++
    else c.sinFicha++
  }
  return c
}

/** El texto del encabezado, armado una sola vez. */
export function resumenDeDirigentes(c: ConteoDeEstados): string {
  const partes = [`${c.activos} activos`, `${c.inactivos} inactivos`]
  if (c.sinFicha > 0) partes.push(`${c.sinFicha} sin ficha`)
  return partes.join(' · ')
}
