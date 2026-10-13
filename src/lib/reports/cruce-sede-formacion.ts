/**
 * DIR-9 · Qué estudios puede dar la gente de cada sede (el ejercicio de
 * Liberia).
 *
 * PARA QUÉ: encontrar HUECOS. El caso que lo pidió fue «en el este sobran de
 * Sirviendo como Jesús y no hay de Panorama»: la capacidad existe pero está
 * mal repartida, y eso no se ve en un total nacional — se ve cruzando sede
 * con formación.
 *
 * Por eso el cero NO es un dato más: es el resultado que se viene a buscar.
 *
 * Cuenta DIRIGENTES ACTIVOS, no todas las fichas. Para decidir dónde abrir
 * un grupo no sirve saber que en Liberia hay tres capacitados en Panorama si
 * los tres están inactivos.
 *
 * Módulo PURO.
 */

export type DirigenteConSede = {
  member_id: string
  nombre: string
  /** Nombre de la sede ya resuelto, o null si no tiene. */
  sede: string | null
  activo: boolean
  /** Códigos de estudio para los que está formado. */
  formacion: readonly string[]
}

export type EstudioDelCruce = { code: string; name: string }

export type CeldaDelCruce = {
  code: string
  total: number
  /** Para el drill-down. */
  miembros: string[]
}

export type FilaDelCruce = {
  sede: string
  /** Activos de esa sede, tengan o no formación registrada. */
  dirigentes: number
  celdas: CeldaDelCruce[]
  /** Los códigos con cero: lo que esa sede NO puede dar hoy. */
  huecos: string[]
}

export type CruceSedeFormacion = {
  estudios: EstudioDelCruce[]
  filas: FilaDelCruce[]
  /**
   * Sin sede calculada. Va aparte y no se reparte: meterlos en una sede
   * inventada haría que el cruce mienta justo donde se lo mira para decidir.
   */
  sinSede: number
}

/** Etiqueta de la fila de quienes no tienen sede. */
export const SIN_SEDE = 'Sin sede'

export function cruceSedeFormacion(
  gente: readonly DirigenteConSede[],
  estudios: readonly EstudioDelCruce[],
): CruceSedeFormacion {
  const activos = gente.filter(g => g.activo)
  const conSede = activos.filter(g => g.sede)

  const porSede = new Map<string, DirigenteConSede[]>()
  for (const g of conSede) {
    const k = g.sede as string
    if (!porSede.has(k)) porSede.set(k, [])
    porSede.get(k)!.push(g)
  }

  /**
   * Las columnas van por COBERTURA, no alfabéticas.
   *
   * Con el orden del catálogo, las primeras doce columnas eran AED, ASF,
   * CDC… — las que casi nadie da — y la tabla abría como un muro de ceros
   * con los números reales fuera de pantalla, a la derecha. Hay que
   * desplazarse para descubrir que sí hay gente.
   *
   * Puestas por cobertura, lo primero que se ve es lo que la organización
   * SÍ puede dar, y los huecos quedan juntos al final, que es donde se los
   * compara entre sedes.
   */
  const cobertura = new Map(estudios.map(e => [
    e.code, conSede.filter(g => new Set(g.formacion).has(e.code)).length,
  ]))
  const ordenados = [...estudios].sort((a, b) =>
    (cobertura.get(b.code) ?? 0) - (cobertura.get(a.code) ?? 0)
    || a.code.localeCompare(b.code, 'es'))

  const filas: FilaDelCruce[] = [...porSede.entries()].map(([sede, suyos]) => {
    const celdas = ordenados.map(e => {
      // Un código repetido en la misma ficha cuenta una vez.
      const quienes = suyos.filter(g => new Set(g.formacion).has(e.code))
      return { code: e.code, total: quienes.length, miembros: quienes.map(g => g.member_id) }
    })
    return {
      sede,
      dirigentes: suyos.length,
      celdas,
      huecos: celdas.filter(c => c.total === 0).map(c => c.code),
    }
  })

  return {
    estudios: ordenados,
    // Las sedes grandes primero: es donde se reparte la mayoría del cuerpo.
    filas: filas.sort((a, b) => b.dirigentes - a.dirigentes || a.sede.localeCompare(b.sede, 'es')),
    sinSede: activos.length - conSede.length,
  }
}
