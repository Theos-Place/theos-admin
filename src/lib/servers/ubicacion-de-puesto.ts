/**
 * Dónde se sirve un puesto de servicio.
 *
 * TRES CASOS Y LOS TRES SON VÁLIDOS (pedido de Floriana, 2026-09-25):
 *   · una SEDE del catálogo — el 95% de los casos;
 *   · un lugar escrito a mano — «Pedregal, Belén», «la casa de Karla», un
 *     retiro;
 *   · VACÍO — el puesto no tiene lugar fijo, o todavía no se sabe. No es un
 *     dato faltante que haya que perseguir.
 *
 * SE GUARDA EL NOMBRE Y NO EL ID DE LA SEDE, y no es pereza: es lo que ya
 * hacía la columna (`Todas las Sedes`, `Pedregal, Belén`) y lo que hace
 * `folletos_sede` en el cierre de grupos. Guardar el id obligaría a migrar los
 * tres valores que hay, a resolver el nombre en cada pantalla, y dejaría los
 * lugares escritos a mano sin dónde vivir — que son justamente los que no son
 * una sede.
 *
 * El costo de esa decisión, escrito para que nadie se sorprenda: si una sede
 * se RENOMBRA, los puestos que la tenían conservan el nombre viejo. Con tres
 * filas usándola hoy, arreglarlo a mano es más barato que el id.
 *
 * Módulo PURO.
 */

/** Valor centinela del selector: abre el campo de texto libre. Nunca se
 *  guarda — el prefijo `__` lo hace imposible de confundir con una sede. */
export const OTRA_UBICACION = '__otra__'

/** Lo que el selector muestra cuando no hay ubicación. Tampoco se guarda. */
export const SIN_UBICACION = ''

export type OpcionDeUbicacion = { value: string; label: string }

/**
 * Las opciones del selector: vacío, las sedes activas, y «Otro lugar…».
 *
 * `guardada` entra como parámetro para que un valor que ya está en la base y
 * NO es una sede activa —una sede que se desactivó, o un texto de antes— siga
 * apareciendo. Sin eso, abrir el puesto para cambiarle otra cosa le borraría
 * la ubicación sin que nadie lo pidiera.
 */
export function opcionesDeUbicacion(
  sedes: ReadonlyArray<{ id: string; name: string }>,
  guardada?: string | null,
): OpcionDeUbicacion[] {
  const opciones: OpcionDeUbicacion[] = [
    { value: SIN_UBICACION, label: 'Sin ubicación' },
    ...sedes.map(s => ({ value: s.name, label: s.name })),
  ]
  const v = (guardada ?? '').trim()
  if (v && !sedes.some(s => s.name === v)) {
    opciones.push({ value: v, label: `${v} (guardada)` })
  }
  opciones.push({ value: OTRA_UBICACION, label: 'Otro lugar…' })
  return opciones
}

/** ¿Lo guardado corresponde a una sede del catálogo? Decide si el selector
 *  arranca en la sede o en «Otro lugar…». */
export function esSedeDelCatalogo(
  valor: string | null | undefined,
  sedes: ReadonlyArray<{ name: string }>,
): boolean {
  const v = (valor ?? '').trim()
  return !!v && sedes.some(s => s.name === v)
}

/**
 * Lo que se guarda, a partir de lo que eligió y escribió la persona.
 *
 * `null` y no cadena vacía cuando no hay nada: la columna es nullable y `''`
 * haría que «sin ubicación» y «ubicación en blanco» fueran dos estados
 * distintos que se ven igual. Toda consulta tendría que preguntar por los dos.
 */
export function valorAGuardar(seleccion: string, textoLibre: string): string | null {
  if (seleccion === OTRA_UBICACION) return textoLibre.trim() || null
  return seleccion.trim() || null
}

/** Cómo se lee en pantalla. */
export function textoDeUbicacion(valor: string | null | undefined): string {
  return (valor ?? '').trim() || 'Sin ubicación'
}
