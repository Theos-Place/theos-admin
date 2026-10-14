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
      // «Dando ahora» estaba suelto al final de la pantalla, lejos del resto
      // (Floriana, 2026-10-14). Es la pregunta que más se hace —quién tiene
      // grupo abierto— y va pegada al estado. Su propio grupo y no una
      // opción de «Estado» porque se CRUZA con él: «activo Y dando ahora»
      // es una pregunta legítima, y dentro de un grupo las opciones suman.
      titulo: 'Grupos',
      opciones: [
        { clave: 'dirigiendo', etiqueta: 'Dando ahora' },
        { clave: 'dirigiendo:no', etiqueta: 'Sin grupo abierto' },
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
    case 'dirigiendo':
      // Se deriva de sus grupos, no de la ficha: quien llama ya lo resolvió.
      return valor === 'no' ? !d.dirigiendo : d.dirigiendo
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

/**
 * DIR-15 · VARIOS FILTROS A LA VEZ (pedido de Floriana, 2026-10-14).
 *
 * Hasta ahora era uno solo: tocar un filtro apagaba el anterior, así que no
 * se podía pedir «los activos que están en pasantía». Tampoco se podía
 * apagar el que estaba puesto sin volver a «Todos».
 *
 * CÓMO COMBINAN, que es la decisión de fondo: dentro de un mismo grupo las
 * opciones suman (activo O inactivo = los dos), y entre grupos se cruzan
 * (activo Y en pasantía). Es lo que la gente espera de una barra de filtros
 * y es lo único que vuelve útil elegir dos cosas del mismo grupo: con «Y»,
 * «activo + inactivo» daría cero y parecería un error del sistema.
 */

/** A qué grupo pertenece una clave, para poder agruparlas al evaluar. */
export const grupoDeLaClave = (clave: ClaveDeFiltro): string => {
  const [tipo] = clave.split(':')
  // `disp:` y `razon:` son el mismo grupo en la pantalla («Disponibilidad»),
  // y tienen que sumar entre sí: «no disponible» y «en pasantía» juntos son
  // lo mismo que «no disponible», no cero.
  if (tipo === 'disp' || tipo === 'razon') return 'disponibilidad'
  return tipo
}

export function cumpleFiltros(
  d: DirigenteFiltrable,
  claves: readonly ClaveDeFiltro[],
): boolean {
  const reales = claves.filter(c => c && c !== 'todos')
  if (reales.length === 0) return true
  const porGrupo = new Map<string, ClaveDeFiltro[]>()
  for (const c of reales) {
    const g = grupoDeLaClave(c)
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), c])
  }
  // Y entre grupos, O dentro de cada uno.
  for (const [, delGrupo] of porGrupo) {
    if (!delGrupo.some(c => cumpleFiltro(d, c))) return false
  }
  return true
}

/**
 * Cuántos quedarían si se tocara CADA opción, con lo que ya está elegido.
 *
 * Es lo que apaga las opciones que no llevan a ningún lado: si está puesto
 * «Activo», «no asiste» da cero —ninguna persona activa tiene razón de
 * inactividad— y el botón se ve deshabilitado. La dependencia que pidió
 * Floriana («si escojo activo, los de inactivo se desactivan») sale SOLA de
 * los datos, sin una tabla de qué excluye a qué: esa tabla habría que
 * mantenerla a mano y se desalinearía con la taxonomía el día que se agregue
 * una razón.
 *
 * Para la opción ya elegida se cuenta cuántos hay CON ella puesta, que es lo
 * que la persona está viendo; apagarla es siempre posible.
 */
export function conteosConSeleccion(
  gente: readonly DirigenteFiltrable[],
  seleccion: readonly ClaveDeFiltro[],
  todas: readonly ClaveDeFiltro[],
): Record<ClaveDeFiltro, number> {
  const out: Record<string, number> = {}
  const elegidas = seleccion.filter(c => c && c !== 'todos')
  for (const clave of todas) {
    if (clave === 'todos') { out[clave] = gente.length; continue }
    const grupo = grupoDeLaClave(clave)
    const yaEsta = elegidas.includes(clave)
    // El resto de la selección: lo de OTROS grupos siempre, y lo del mismo
    // grupo solo si esta opción ya estaba (ahí se mira el resultado actual).
    const resto = elegidas.filter(c => grupoDeLaClave(c) !== grupo)
    const conEsta = yaEsta ? elegidas : [...resto, clave]
    out[clave] = gente.filter(d => cumpleFiltros(d, conEsta)).length
  }
  return out
}

/** Tocar una opción: la prende si estaba apagada y la apaga si estaba puesta. */
export function alternarFiltro(
  seleccion: readonly ClaveDeFiltro[],
  clave: ClaveDeFiltro,
): ClaveDeFiltro[] {
  // «Todos» no es una opción más: es borrar la selección.
  if (clave === 'todos') return []
  return seleccion.includes(clave)
    ? seleccion.filter(c => c !== clave)
    : [...seleccion.filter(c => c !== 'todos'), clave]
}
