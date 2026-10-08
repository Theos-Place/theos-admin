/**
 * LINT-1 · El estado de una lista que ACUMULA páginas, derivado del sello.
 *
 * `estado-de-carga.ts` resolvió el caso de "traer una cosa": se guarda el dato
 * con el sello de la petición que lo produjo y "cargando" pasa a ser una
 * comparación. Una lista paginada no encajaba ahí por dos razones, y son las
 * que este módulo agrega:
 *
 *  1. **El dato se acumula.** La página 2 no reemplaza a la 1, se le suma. Lo
 *     acumulado pertenece al mismo sello, así que se guarda junto con él.
 *  2. **Hay DOS cargas distintas y no se pueden confundir.** Traer la primera
 *     página deja la pantalla sin nada que mostrar; traer la siguiente no —la
 *     lista sigue ahí y lo que se espera es que crezca. Una sola bandera
 *     `loading` para las dos hacía que "cargar más" vaciara la tabla y la
 *     volviera a pintar.
 *
 * Puro a propósito: el repo corre vitest en `node` y no puede renderizar hooks,
 * así que lo que se puede probar es esta parte.
 */

/**
 * Lo acumulado, junto con de qué petición base vino.
 *
 * `extra` es lo que algunos endpoints mandan AL LADO de la lista y vale para el
 * filtro entero, no para la página: la suma de montos de donaciones, por
 * ejemplo. Viaja con el sello porque pertenece a la misma consulta — si se
 * guardara aparte, al cambiar de filtro se vería la suma vieja junto a la lista
 * nueva.
 */
export type ListaGuardada<T, E = undefined> = {
  sello: string
  items: T[]
  total: number
  /** Última página traída. La 1 es la del sello; las demás vienen de `loadMore`. */
  pagina: number
  error: string | null
  extra?: E | null
}

export type EstadoDeLista<T, E = undefined> = {
  items: T[]
  total: number
  pagina: number
  extra: E | null
  /** La PRIMERA página está en camino: la pantalla no tiene nada que enseñar. */
  cargando: boolean
  error: string | null
  /** Queda por traer. */
  hayMas: boolean
}

/**
 * @param sello     la petición base que se quiere tener (clave + intento).
 * @param guardado  lo último acumulado, o null si todavía no llegó nada.
 * @param conservarMientrasCarga  mostrar lo viejo mientras llega lo nuevo.
 *
 * MIENTRAS CARGA NO SE MUESTRA LO VIEJO, y ese default cambió el 2026-10-08.
 *
 * Antes sí: «parpadear a vacío en cada cambio de filtro es peor que enseñar
 * por un instante lo de antes». Suena razonable y es verdad para un buscador
 * que escribe letra a letra — pero NO para un filtro de estado, donde las
 * filas viejas CONTRADICEN lo que el botón dice.
 *
 * Floriana lo reportó así: «si escojo fallidos, aun así me lista entregados».
 * El endpoint filtraba perfecto —medido, devolvía 2 fallidos y nada más—; lo
 * que ella veía eran las 200 filas entregadas de antes, todavía en pantalla
 * bajo un botón que decía «Fallidos». No es un parpadeo: es la pantalla
 * afirmando algo falso, y se lee como que el filtro no sirve.
 *
 * Paginar es el caso donde sí hay que conservar, y ese no pasa por acá:
 * `loadMore` suma sobre el MISMO sello, así que la lista nunca se vacía al
 * traer la página siguiente.
 *
 * Quien tenga un buscador de los que escriben letra a letra pasa
 * `conservarMientrasCarga` en true y recupera el comportamiento viejo.
 */
export function estadoDeLista<T, E = undefined>(
  sello: string,
  guardado: ListaGuardada<T, E> | null,
  conservarMientrasCarga = false,
): EstadoDeLista<T, E> {
  const alDia = guardado?.sello === sello
  const items = alDia || conservarMientrasCarga ? guardado?.items ?? [] : []
  const total = alDia || conservarMientrasCarga ? guardado?.total ?? 0 : 0
  return {
    items,
    total,
    pagina: guardado?.pagina ?? 1,
    // `extra` es del filtro (una suma, un conteo): con el sello viejo se
    // esconde por la misma razón que las filas — sería el número de otro filtro.
    extra: alDia || conservarMientrasCarga ? guardado?.extra ?? null : null,
    cargando: !alDia,
    error: guardado?.error ?? null,
    // Con el sello viejo NO se ofrece "cargar más": se estaría paginando sobre
    // un resultado que ya no corresponde a los filtros actuales.
    hayMas: alDia && items.length < total,
  }
}

/**
 * Sumar una página a lo acumulado.
 *
 * Devuelve `null` —y el llamador descarta el resultado— cuando la respuesta ya
 * no corresponde: cambió el sello mientras estaba en vuelo, o es una página que
 * no es la siguiente. Sin esa comprobación, cambiar de filtro con una petición
 * a medio camino pegaba las filas del filtro anterior debajo de las nuevas.
 */
export function sumarPagina<T, E = undefined>(
  guardado: ListaGuardada<T, E> | null,
  entrante: { sello: string; items: T[]; total: number; pagina: number },
): ListaGuardada<T, E> | null {
  if (!guardado || guardado.sello !== entrante.sello) return null
  if (entrante.pagina !== guardado.pagina + 1) return null
  return {
    sello: guardado.sello,
    items: [...guardado.items, ...entrante.items],
    // El total puede haber cambiado entre páginas: manda el más reciente.
    total: entrante.total,
    pagina: entrante.pagina,
    error: null,
    // `extra` es del FILTRO, no de la página: se conserva el de la primera.
    extra: guardado.extra,
  }
}
