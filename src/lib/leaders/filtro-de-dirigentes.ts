/**
 * DIR-12 · Los filtros de la lista de dirigentes, con la taxonomía de DIR-8.
 *
 * QUÉ ESTABA MAL: la lista filtraba por `availability_status`, el campo
 * ANTERIOR. Desde DIR-8 el estado vive en cuatro campos —estado base, razón
 * de inactividad, disponibilidad y razón de no disponibilidad— más las
 * banderitas de revisión, y ninguno de esos valores se podía filtrar. La
 * coordinación veía estados nuevos en cada ficha y no tenía cómo pedir «los
 * que están en pasantía».
 *
 * EL FILTRO USA LA DISPONIBILIDAD EFECTIVA, no la guardada. Si preguntara
 * por la columna, «Disponibles» devolvería a las 106 personas que tienen un
 * grupo abierto y figuran disponibles — justo el bug que DIR-9 destapó, pero
 * ahora en la pantalla donde se eligen los dirigentes para asignar grupos.
 *
 * Módulo PURO.
 */
import {
  RAZONES_NO_DISPONIBLE, RAZONES_INACTIVO, RAZONES_DE_REVISION,
  ETIQUETA_BASE, ETIQUETA_DISPONIBILIDAD, ETIQUETA_NO_DISPONIBLE,
  ETIQUETA_RAZON_INACTIVO, ETIQUETA_REVISION,
  type RazonNoDisponible, type RazonInactivo, type RazonDeRevision,
} from './estado-del-dirigente'
import { disponibilidadEfectiva } from './esta-dirigiendo'

/** Lo que el filtro necesita saber de un dirigente. */
export type DirigenteFiltrable = {
  estado_base: string | null
  disponibilidad: string | null
  razon_no_disponible: string | null
  razon_inactivo: string | null
  revision: readonly string[] | null
  /** Derivado de sus grupos, no de la ficha. */
  dirigiendo: boolean
}

/**
 * La clave del filtro, como texto, para que viva en la URL y en el estado
 * del componente sin un objeto que serializar.
 *
 *   todos · base:activo · disp:disponible · razon:pasantia ·
 *   inactivo:no_asiste · revision · revision:testimonio
 */
export type ClaveDeFiltro = string

export type OpcionDeFiltro = { clave: ClaveDeFiltro; etiqueta: string }
export type GrupoDeFiltros = { titulo: string; opciones: OpcionDeFiltro[] }

/**
 * Los filtros AGRUPADOS, que es lo que los vuelve usables: planos eran
 * quince botones en fila y había que leerlos todos para encontrar uno.
 *
 * Las banderitas van en su propio grupo y solo para quien puede verlas: su
 * sola existencia dice que hay una situación abierta con esa persona.
 */
export function gruposDeFiltros(opts: { verBanderitas: boolean }): GrupoDeFiltros[] {
  const grupos: GrupoDeFiltros[] = [
    {
      titulo: 'Estado',
      opciones: [
        { clave: 'todos', etiqueta: 'Todos' },
        { clave: 'base:activo', etiqueta: ETIQUETA_BASE.activo },
        { clave: 'base:inactivo', etiqueta: ETIQUETA_BASE.inactivo },
      ],
    },
    {
      titulo: 'Disponibilidad',
      opciones: [
        { clave: 'disp:disponible', etiqueta: ETIQUETA_DISPONIBILIDAD.disponible },
        { clave: 'disp:no_disponible', etiqueta: ETIQUETA_DISPONIBILIDAD.no_disponible },
        ...RAZONES_NO_DISPONIBLE.map(r => ({
          clave: `razon:${r}`, etiqueta: ETIQUETA_NO_DISPONIBLE[r as RazonNoDisponible],
        })),
      ],
    },
    {
      titulo: 'Por qué está inactivo',
      opciones: RAZONES_INACTIVO.map(r => ({
        clave: `inactivo:${r}`, etiqueta: ETIQUETA_RAZON_INACTIVO[r as RazonInactivo],
      })),
    },
  ]
  if (opts.verBanderitas) {
    grupos.push({
      titulo: 'Revisión',
      opciones: [
        { clave: 'revision', etiqueta: 'Con banderita' },
        ...RAZONES_DE_REVISION.map(r => ({
          clave: `revision:${r}`, etiqueta: ETIQUETA_REVISION[r as RazonDeRevision],
        })),
      ],
    })
  }
  return grupos
}

/** ¿Esta persona pasa el filtro? */
export function cumpleFiltro(d: DirigenteFiltrable, clave: ClaveDeFiltro): boolean {
  if (!clave || clave === 'todos') return true

  const efectiva = disponibilidadEfectiva({
    estado: {
      estado_base: d.estado_base,
      disponibilidad: d.disponibilidad,
      razon_no_disponible: d.razon_no_disponible,
    },
    dirigiendo: d.dirigiendo,
  })
  const [tipo, valor] = clave.split(':')

  switch (tipo) {
    case 'base':
      return d.estado_base === valor
    case 'disp':
      return efectiva.disponibilidad === valor
    case 'razon':
      return efectiva.razonNoDisponible === valor
    case 'inactivo':
      // Solo tiene sentido en un inactivo: un activo con una razón vieja
      // guardada no debería colarse acá.
      return d.estado_base === 'inactivo' && d.razon_inactivo === valor
    case 'revision':
      return valor
        ? (d.revision ?? []).includes(valor)
        : (d.revision ?? []).length > 0
    default:
      // Una clave que nadie reconoce NO filtra nada: mostrar todo es menos
      // malo que una lista vacía que parece «no hay dirigentes».
      return true
  }
}

/** Cuántos caen en cada opción, para poder mostrarlo al lado del botón. */
export function conteoPorFiltro(
  gente: readonly DirigenteFiltrable[],
  claves: readonly ClaveDeFiltro[],
): Record<ClaveDeFiltro, number> {
  const out: Record<string, number> = {}
  for (const c of claves) out[c] = gente.filter(d => cumpleFiltro(d, c)).length
  return out
}
