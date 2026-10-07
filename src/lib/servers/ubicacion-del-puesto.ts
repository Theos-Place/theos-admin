/**
 * SRV · De qué sede es un puesto, y en qué cantón queda.
 *
 * EL PEDIDO (Floriana, 2026-10-07): el filtro de la cartelera debería ser la
 * UBICACIÓN de verdad —Sede Meridiano es Escazú— y los comités que no son
 * sede no deberían tener ninguna, porque un puesto del Comité Campamentos o
 * del Comité Youth no se hace en un cantón.
 *
 * LO QUE HABÍA. El filtro de la cartelera interna decía «Todas las
 * ubicaciones» y filtraba por el ÁREA («Área de Ministerios»): estaba mal
 * rotulado, nada más. La cartelera pública sí lee `vacancies.location`, pero
 * las 32 vacantes publicadas lo tienen en null, así que ese filtro ni
 * aparecía.
 *
 * EL CANTÓN VIVE EN LA SEDE, no en cada vacante: son 26 vacantes de 6 sedes
 * y repetir el dato 26 veces —y otra vez con cada puesto nuevo— es pedir que
 * se desincronice.
 *
 * Módulo PURO.
 */

/**
 * ¿Este comité es una sede?
 *
 * Por el prefijo «Sede » del nombre, que es como están en la base: «Sede
 * Antares», «Sede Pedregal Jueves». Se verificó contra los 8 comités con
 * vacantes publicadas — los dos que no son sede son «Comité Campamentos» y
 * «Comité Youth», y ninguno empieza así.
 *
 * Es una convención de nombres y por eso lleva test: el día que alguien
 * llame «Pedregal Jueves» a secas a un comité de sede, su ubicación
 * desaparece sin ruido.
 */
export function esComiteDeSede(nombreDelComite: string | null | undefined): boolean {
  return /^sede\s/i.test((nombreDelComite ?? '').trim())
}

/**
 * La ubicación que se muestra y por la que se filtra.
 *
 * `null` cuando el comité no es una sede, o cuando la sede todavía no tiene
 * cantón cargado. Las dos cosas se ven igual en pantalla —sin ubicación— y
 * eso está bien: un filtro vacío es honesto, uno con un cantón adivinado
 * manda a alguien al lugar equivocado.
 */
export function ubicacionDelPuesto(input: {
  nombreDelComite: string | null | undefined
  /** `sedes.canton` de la sede de ese comité, si la hay. */
  cantonDeLaSede: string | null | undefined
}): string | null {
  if (!esComiteDeSede(input.nombreDelComite)) return null
  const c = (input.cantonDeLaSede ?? '').trim()
  return c || null
}

/** Las opciones del filtro: las ubicaciones que de verdad existen, ordenadas
 *  y sin repetir. Vacío = el filtro no se dibuja. */
export function opcionesDeUbicacion(
  puestos: ReadonlyArray<{ location?: string | null }>,
): string[] {
  return [...new Set(puestos.map(p => p.location).filter((x): x is string => !!x))]
    .sort((a, b) => a.localeCompare(b, 'es'))
}
