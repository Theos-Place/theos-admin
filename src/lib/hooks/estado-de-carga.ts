/**
 * LINT-1 · "Cargando" se DERIVA, no se pone a mano.
 *
 * EL PATRÓN QUE SE REEMPLAZA. Medio repo tenía esto:
 *
 *     const cargar = useCallback(async () => {
 *       setLoading(true); setError(null)
 *       try { setDatos(await traer()) } catch { setError(...) }
 *       finally { setLoading(false) }
 *     }, [deps])
 *     useEffect(() => { cargar() }, [cargar])
 *
 * `react-hooks/set-state-in-effect` lo marca, y con razón: un `setState`
 * síncrono al entrar al efecto provoca un segundo render inmediato antes de que
 * se pinte nada. Eran 67 avisos en 60 archivos.
 *
 * EL CAMINO CORTO NO SIRVE. Reordenar el async no lo apaga —está comprobado que
 * la regla marca igual un `useCallback` async cuyo único `setState` va después
 * del `await`— y pasar de `await` a `.then` sería maquillaje: el `setState`
 * corre en el mismo tick.
 *
 * LA REGLA DE VERDAD. Se guarda UN estado con el SELLO de la petición que lo
 * produjo. "Cargando" es entonces una comparación —"lo que tengo no es de la
 * petición que quiero"— y no un booleano que alguien tiene que acordarse de
 * apagar. De paso desaparece la clase entera de bug en que `loading` se queda
 * en true porque una rama del `try` se olvidó del `finally`.
 *
 * Esta parte es pura para poder fijarla con tests: el repo corre vitest en
 * `node` y no puede renderizar hooks.
 */

/** Lo guardado, junto con de qué petición vino. */
export type Guardado<T> = { sello: string; datos: T | null; error: string | null }

/**
 * El sello identifica una petición concreta: la clave de sus parámetros más el
 * número de recargas manuales. Sin el intento, pedir "recargar" con los mismos
 * parámetros no cambiaría nada y el efecto no volvería a correr.
 */
export function selloDeCarga(clave: string, intento: number): string {
  return `${clave}#${intento}`
}

export type EstadoDeCarga<T> = { datos: T | null; cargando: boolean; error: string | null }

/**
 * @param sello    la petición que se quiere tener.
 * @param guardado lo último que llegó, o null si todavía no llegó nada.
 *
 * Mientras el sello guardado no sea el pedido, está cargando — y se siguen
 * mostrando los datos viejos, que es lo que la pantalla quiere: parpadear a
 * vacío en cada recarga es peor que enseñar un dato de hace un segundo.
 */
export function estadoDeCarga<T>(sello: string, guardado: Guardado<T> | null): EstadoDeCarga<T> {
  return {
    datos: guardado?.datos ?? null,
    cargando: guardado?.sello !== sello,
    // El error es de la carga que se está mostrando; si hay una nueva en vuelo,
    // el error viejo sigue visible hasta que llegue la respuesta. Borrarlo antes
    // deja la pantalla sin explicación en el medio.
    error: guardado?.error ?? null,
  }
}

/** El texto de un error de carga. Un Error trae mensaje; cualquier otra cosa
 *  (un string lanzado, un objeto raro) cae a un texto genérico en vez de
 *  mostrar "[object Object]". */
export function mensajeDeError(e: unknown, generico: string): string {
  return e instanceof Error && e.message ? e.message : generico
}
