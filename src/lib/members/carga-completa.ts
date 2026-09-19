/**
 * "Cargar todos los resultados" del padrón.
 *
 * La tabla trae de 50 en 50, y para una búsqueda de 300 personas eso son seis
 * clics. Este módulo decide de una sola vez cuántas tandas hacen falta.
 *
 * Dos decisiones que no son obvias:
 *
 * 1) Se relee desde la página 1 con tandas grandes en vez de continuar donde
 *    iba la paginación. Lo cargado casi nunca es múltiplo del tamaño grande
 *    (50, 100, 150… contra tandas de 200), así que "seguir" obligaría a
 *    mezclar dos tamaños de página y cualquier error de offset se traduce en
 *    personas repetidas o saltadas. Repetir los primeros 50 es barato.
 *
 * 2) Hay un tope. La tabla dibuja una fila por persona sin virtualizar, así
 *    que traer el padrón entero (23.963 fichas) cuelga el navegador. Por
 *    encima del tope no se ofrece el botón: para eso está Exportar, que ya
 *    baja el filtro completo sin pasar por el DOM.
 */

/** Máximo que acepta `pageSize` en GET /api/members. */
export const TAMANO_DE_TANDA = 200

/** Tope de filas que la tabla dibuja de un solo golpe. */
export const TOPE_DE_CARGA_COMPLETA = 5000

export type PlanDeCarga =
  | { puede: false; motivo: 'completo' | 'demasiados'; faltan: number }
  | { puede: true; faltan: number; paginas: number[]; tamano: number }

export function planDeCargaCompleta(
  cargados: number,
  total: number,
  tamano: number = TAMANO_DE_TANDA,
): PlanDeCarga {
  const faltan = Math.max(0, total - cargados)
  if (faltan === 0) return { puede: false, motivo: 'completo', faltan: 0 }
  if (total > TOPE_DE_CARGA_COMPLETA) return { puede: false, motivo: 'demasiados', faltan }

  const paginas: number[] = []
  for (let p = 1; p <= Math.ceil(total / tamano); p++) paginas.push(p)
  return { puede: true, faltan, paginas, tamano }
}
