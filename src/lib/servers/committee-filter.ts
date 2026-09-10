/**
 * Qué servidores del comité se muestran — y, por lo tanto, cuáles se exportan.
 *
 * Vive acá y no suelto en la página porque el export y la tabla TIENEN que usar
 * la misma lista. Cuando eran dos expresiones distintas se separaron: la tabla
 * filtraba y el archivo bajaba el comité entero, así que en Sede Meridiano
 * Martes el encabezado decía 67 y el CSV traía 84 filas (los 67 activos más 17
 * inactivos). Con una sola función no se pueden volver a desalinear.
 */
export type EstadoServidor = 'active' | 'inactive'
export type FiltroEstado = EstadoServidor | 'all'

export type ServidorFiltrable = { name: string; status: string; position?: string | null }

/** Valor del filtro de puesto: 'all' o el título exacto del puesto. */
export const TODOS_LOS_PUESTOS = 'all'

export function filtrarServidores<T extends ServidorFiltrable>(
  servidores: readonly T[],
  filtros: { search?: string; status?: FiltroEstado; position?: string },
): T[] {
  const q = (filtros.search ?? '').trim().toLowerCase()
  const estado = filtros.status ?? 'active'
  const puesto = filtros.position ?? TODOS_LOS_PUESTOS
  return servidores.filter(s =>
    (!q || s.name.toLowerCase().includes(q))
    && (estado === 'all' || s.status === estado)
    && (puesto === TODOS_LOS_PUESTOS || (s.position ?? '') === puesto))
}

/**
 * Los puestos que hay para ofrecer en el filtro.
 *
 * Salen de la gente que está en el comité, no de un catálogo: un comité tiene
 * decenas de puestos definidos y casi todos vacíos —en Comité Estudios Bíblicos
 * hay 15 títulos y solo 5 con gente—, así que listarlos todos sería un
 * desplegable lleno de opciones que no filtran nada.
 *
 * Se miran TODOS los servidores, no los ya filtrados: si dependiera del filtro
 * de estado, elegir un puesto que solo tienen inactivos lo haría desaparecer de
 * la lista y no habría cómo volver.
 */
export function puestosDisponibles<T extends ServidorFiltrable>(servidores: readonly T[]): string[] {
  const vistos = new Set<string>()
  for (const s of servidores) {
    const p = (s.position ?? '').trim()
    if (p) vistos.add(p)
  }
  return [...vistos].sort((a, b) => a.localeCompare(b, 'es'))
}

/**
 * Agrupa las filas por PERSONA.
 *
 * Una persona puede tener varios puestos en el mismo comité (lo permite el
 * modelo: una fila por member+position). Sin agrupar, aparece dos veces en la
 * tabla y se lee como un duplicado por error — que es justo el bug de filas
 * fantasma que ya arreglamos por otro lado. Acá el nombre va una vez y sus
 * puestos se listan juntos.
 *
 * El ORDEN de las personas respeta el de entrada: la tabla ya viene ordenada
 * por lo que el usuario eligió, y reordenar acá lo pisaría.
 */
export type ServidorAgrupado<T> = {
  member_id: string
  name: string
  /** Una entrada por puesto, en el orden en que vinieron. */
  puestos: T[]
  /** 'active' si al menos un puesto lo está: la persona sigue sirviendo. */
  status: EstadoServidor
}

export function agruparPorPersona<T extends ServidorFiltrable & { member_id: string }>(
  servidores: readonly T[],
): Array<ServidorAgrupado<T>> {
  const porPersona = new Map<string, ServidorAgrupado<T>>()
  for (const s of servidores) {
    const ya = porPersona.get(s.member_id)
    if (ya) {
      ya.puestos.push(s)
      // Basta un puesto activo para que la persona cuente como activa: tener
      // uno viejo dado de baja no la saca del comité.
      if (s.status === 'active') ya.status = 'active'
      continue
    }
    porPersona.set(s.member_id, {
      member_id: s.member_id,
      name: s.name,
      puestos: [s],
      status: s.status === 'active' ? 'active' : 'inactive',
    })
  }
  return [...porPersona.values()]
}

/**
 * Cuántos PUESTOS ocupados y cuántas PERSONAS hay en un comité.
 *
 * Sofía lo reportó el 2026-09-10 sobre Sede Madrid: el encabezado decía "47
 * servidores activos" y no eran 47 personas — eran 47 puestos, porque hay
 * gente con más de uno. El número mentía sobre el tamaño del equipo.
 *
 * Los dos números sirven y por eso se muestran los dos: puestos es lo que hay
 * que cubrir, personas es a cuánta gente hay que convocar.
 */
export function conteoDelComite(
  servidores: readonly (ServidorFiltrable & { member_id: string })[],
): { puestos: number; personas: number } {
  const activos = servidores.filter(s => s.status === 'active')
  return {
    puestos: activos.length,
    personas: new Set(activos.map(s => s.member_id)).size,
  }
}

/** Cómo se lee en el encabezado. Cuando cada quien tiene un solo puesto los dos
 *  números son iguales y repetirlos sobra, así que se dice uno. */
export function textoDelConteo(c: { puestos: number; personas: number }): string {
  const personas = `${c.personas} ${c.personas === 1 ? 'persona' : 'personas'}`
  if (c.puestos === c.personas) return `${personas}`
  return `${personas} en ${c.puestos} puestos`
}
