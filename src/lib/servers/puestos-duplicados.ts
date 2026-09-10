/**
 * Puestos repetidos dentro de un comité: el mismo puesto escrito de dos formas.
 * "Colaborador Información" y "Colaborador de Informacion" son UNO solo, con la
 * gente partida en dos filas y nadie sabiendo a cuál asignar.
 *
 * REGLA (decisión del usuario, 2026-09-10): gana el que NO lleva "de". Si el
 * único candidato lo lleva, se le quita del título.
 *
 * El "de" y las tildes no cambian los roles automáticos —POSITION_ROLE_RULES
 * normaliza igual, verificado— así que consolidar no mueve permisos. Lo que sí
 * importa es a quién hay que trasladar antes de borrar la fila perdedora:
 * borrar un puesto arrastra en CASCADE sus volunteers y sus
 * member_role_position_grants.
 */
// Dos regex y no una con /g reutilizada: .test() sobre una regex global
// guarda lastIndex entre llamadas y devuelve true/false alternado. Con una
// sola, tieneArticulo mentía en llamadas consecutivas y el plan elegía el
// puesto equivocado — lo agarró el test de "si los dos llevan de".
const ARTICULOS_GLOBAL = /\b(de|del|la|el|los|las)\b/gi
const TIENE_ARTICULO = /\b(de|del|la|el|los|las)\b/i

/** Cómo leería una persona el título: sin tildes, sin artículos, minúsculas. */
export function normalizarTitulo(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(ARTICULOS_GLOBAL, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** ¿El título lleva un artículo suelto ("de", "del", …)? */
export function tieneArticulo(titulo: string): boolean {
  return TIENE_ARTICULO.test(titulo.normalize('NFD').replace(/[̀-ͯ]/g, ''))
}

/** El título sin los artículos, con los espacios arreglados. Conserva tildes y
 *  mayúsculas: "Colaborador de Información" → "Colaborador Información". */
export function sinArticulos(titulo: string): string {
  return titulo.replace(ARTICULOS_GLOBAL, ' ').replace(/\s+/g, ' ').trim()
}

export type PuestoCandidato = {
  id: string
  title: string
  /** Servidores ACTIVOS en ese puesto. */
  activos: number
}

export type PlanDeConsolidacion = {
  /** El que se queda. */
  sobreviviente: PuestoCandidato
  /** Cómo debe llamarse al final. Distinto de `sobreviviente.title` solo si
   *  había que quitarle el "de". */
  tituloFinal: string
  /** Los que se borran, después de mudarles la gente. */
  aBorrar: PuestoCandidato[]
  /** Personas que hay que mover antes de borrar (suma de los perdedores). */
  personasAMover: number
}

/**
 * @param candidatos los puestos de UN comité que son el mismo nombre.
 * @returns null si no hay nada que consolidar (menos de dos).
 */
export function planDeConsolidacion(candidatos: readonly PuestoCandidato[]): PlanDeConsolidacion | null {
  if (candidatos.length < 2) return null

  const orden = [...candidatos].sort((a, b) => {
    // 1. Gana el que no lleva "de" — la regla pedida.
    const artA = tieneArticulo(a.title) ? 1 : 0
    const artB = tieneArticulo(b.title) ? 1 : 0
    if (artA !== artB) return artA - artB
    // 2. Entre iguales, el que ya tiene gente: mover a nadie es mejor que
    //    mover a alguien, y menos movimientos es menos que puede salir mal.
    if (a.activos !== b.activos) return b.activos - a.activos
    // 3. Desempate estable: el título escrito con tildes es el que está bien.
    const tildeA = a.title === a.title.normalize('NFD').replace(/[̀-ͯ]/g, '') ? 1 : 0
    const tildeB = b.title === b.title.normalize('NFD').replace(/[̀-ͯ]/g, '') ? 1 : 0
    if (tildeA !== tildeB) return tildeA - tildeB
    return a.id.localeCompare(b.id)
  })

  const [sobreviviente, ...aBorrar] = orden
  return {
    sobreviviente,
    tituloFinal: sinArticulos(sobreviviente.title),
    aBorrar,
    personasAMover: aBorrar.reduce((n, p) => n + p.activos, 0),
  }
}
