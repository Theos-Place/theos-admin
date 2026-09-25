/**
 * PAR-5b · ¿Hay algún filtro puesto en el padrón?
 *
 * Suena a una línea y por eso estaba escrita TRES VECES en la misma pantalla
 * —`shouldFetch`, `hasAnyFilter` y `exportConfirm`—, cada una con su propia
 * lista de banderas. Dos estaban completas y la tercera se había quedado sin
 * las condiciones avanzadas y sin el chip de asistencia a estudios.
 *
 * EL DAÑO (reportado por Ari): filtró con una condición avanzada, le quedaron
 * 431 resultados, y al exportar le saltó «Vas a exportar 24.000 miembros» —el
 * padrón entero—. El archivo venía bien, porque `filterQS()` sí manda las
 * condiciones; el que mentía era el aviso. Pero un aviso que dice 24.000 cuando
 * vas a bajar 431 es peor que no tener aviso: o lo cancelás sin necesidad, o
 * dejás de creerle para siempre.
 *
 * Módulo PURO y con tests para que la lista de banderas viva en UN lugar. Si
 * mañana se agrega un filtro nuevo, se agrega acá y los tres usos se enteran.
 */

export type FiltrosDelPadron = {
  /** La búsqueda por texto, ya validada (dos caracteres o más). */
  busqueda: boolean
  donantes: boolean
  servidores: boolean
  /** Chip de asistencia general. */
  activos: boolean
  /** Chip de asistencia con el criterio de estudios (más estricto). */
  asistenciaDeEstudios: boolean
  /** Cuántas condiciones avanzadas hay puestas. */
  condiciones: number
}

/**
 * ¿Está el padrón acotado por algo?
 *
 * Las condiciones avanzadas CUENTAN. Es justamente lo que se había olvidado, y
 * es el filtro más potente que tiene la pantalla: quien lo usa es quien más
 * confía en el número que le muestren después.
 */
export function hayFiltroActivo(f: FiltrosDelPadron): boolean {
  return f.busqueda || f.donantes || f.servidores || f.activos
    || f.asistenciaDeEstudios || f.condiciones > 0
}

/**
 * El aviso antes de exportar, o `undefined` cuando no hace falta.
 *
 * Solo se avisa cuando NO hay filtro: ahí sí se está por bajar el padrón
 * completo y conviene preguntar. Con cualquier filtro puesto el export es
 * intencional y acotado, así que el modal solo estorba.
 *
 * Recibe el total como parámetro para no tener que adivinar de dónde sale: con
 * filtro es el de los resultados y sin filtro el del padrón, y mezclarlos fue
 * exactamente el error.
 */
export function avisoDeExportacion(f: FiltrosDelPadron, totalDelPadron: number): string | undefined {
  if (hayFiltroActivo(f)) return undefined
  return `Vas a exportar ${totalDelPadron.toLocaleString('es-CR')} miembros. Esto puede tardar unos segundos. ¿Continuás?`
}
