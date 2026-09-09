/**
 * Una persona pertenece a UNA familia. Vincular a dos que ya tienen familia no
 * crea una tercera ni las deja separadas: las FUSIONA.
 *
 * BUG 2026-09-09 (caso Chavarría / Hernández): al vincular a Fernando con
 * Marielena —esposos, cada uno con hijos previos—, linkFamilyMember tomaba la
 * familia del titular e insertaba a la otra persona ahí, sin mirar nunca si ella
 * ya tenía familia. Resultado: Marielena quedó en DOS unidades, los hijos de
 * ella en una y el de él en la otra. El esquema lo permitía porque family_members
 * solo tenía UNIQUE (family_unit_id, member_id).
 *
 * REGLAS DE LA FUSIÓN, y por qué:
 *
 *  · Sobrevive la unidad MÁS ANTIGUA, con su nombre. Es la que lleva más tiempo
 *    referenciada y la que más gente reconoce; elegir "la del titular" o "la del
 *    nombre más largo" serían reglas igual de arbitrarias pero menos predecibles.
 *    Si el nombre resultante no gusta, se edita — es un dato, no una identidad.
 *
 *  · Cada integrante se muda con SU relation y SU linked_by. Son datos que
 *    alguien escribió sobre esa persona; la fusión no los reinterpreta.
 *
 *  · Si alguien está en las DOS unidades (solo pasa reparando el desastre que
 *    dejó el bug), sobrevive su fila MÁS RECIENTE. La unidad vieja gana como
 *    contenedor, pero sobre una persona concreta vale lo último que un humano
 *    dijo de ella: Marielena figura 'Otro' en la familia vieja y 'Cónyuge' en la
 *    nueva, y 'Cónyuge' es lo que alguien afirmó al vincularla.
 *
 *  · La fusión ENCADENA: si A comparte gente con B y B con C, las tres terminan
 *    siendo una sola. Sin esto, reparar dejaría pares fusionados pero el grupo
 *    partido.
 */

export type FilaFamilia = {
  family_unit_id: string
  member_id: string
  relation: string | null
  linked_by: string | null
  /** Cuándo se vinculó esa persona a esa unidad (ISO). */
  created_at: string
}

export type Unidad = {
  id: string
  name: string | null
  /** Cuándo se creó la unidad (ISO). */
  created_at: string
}

/** Cuál de las unidades sobrevive: la más antigua. Con la misma fecha, desempata
 *  el id, para que el resultado no dependa del orden en que vengan las filas. */
export function unidadSobreviviente(unidades: readonly Unidad[]): Unidad | null {
  if (unidades.length === 0) return null
  return [...unidades].sort((a, b) => {
    const t = Date.parse(a.created_at) - Date.parse(b.created_at)
    return t !== 0 ? t : a.id.localeCompare(b.id)
  })[0]
}

export type Movimiento = {
  member_id: string
  desde: string
  hacia: string
  relation: string | null
  linked_by: string | null
}

export type PlanDeFusion = {
  /** La unidad que queda. null si no hay nada que fusionar. */
  sobrevive: string | null
  /** Unidades que desaparecen (quedan vacías y se borran). */
  seEliminan: string[]
  /** Filas a mover a la unidad sobreviviente. */
  movimientos: Movimiento[]
  /** Integrantes finales de la unidad sobreviviente, con su relation resuelta. */
  integrantesFinales: Array<{ member_id: string; relation: string | null }>
}

/**
 * Plan para fusionar un conjunto de unidades en una sola.
 * No toca la base: describe qué habría que hacer, y eso es lo que se prueba.
 */
export function planificarFusion(
  unidades: readonly Unidad[],
  filas: readonly FilaFamilia[],
): PlanDeFusion {
  const vacio: PlanDeFusion = { sobrevive: null, seEliminan: [], movimientos: [], integrantesFinales: [] }
  if (unidades.length === 0) return vacio
  const ganadora = unidadSobreviviente(unidades)!
  if (unidades.length === 1) {
    return {
      sobrevive: ganadora.id,
      seEliminan: [],
      movimientos: [],
      integrantesFinales: filas
        .filter(f => f.family_unit_id === ganadora.id)
        .map(f => ({ member_id: f.member_id, relation: f.relation })),
    }
  }

  const idsUnidades = new Set(unidades.map(u => u.id))
  const propias = filas.filter(f => idsUnidades.has(f.family_unit_id))

  // Por persona, la fila que vale: la más reciente (ver la cabecera). Con el
  // mismo instante desempata la unidad, otra vez para no depender del orden.
  const porPersona = new Map<string, FilaFamilia>()
  for (const f of propias) {
    const actual = porPersona.get(f.member_id)
    if (!actual) { porPersona.set(f.member_id, f); continue }
    const t = Date.parse(f.created_at) - Date.parse(actual.created_at)
    if (t > 0 || (t === 0 && f.family_unit_id.localeCompare(actual.family_unit_id) > 0)) {
      porPersona.set(f.member_id, f)
    }
  }

  const movimientos: Movimiento[] = []
  for (const [memberId, fila] of porPersona) {
    if (fila.family_unit_id === ganadora.id) continue
    movimientos.push({
      member_id: memberId,
      desde: fila.family_unit_id,
      hacia: ganadora.id,
      relation: fila.relation,
      linked_by: fila.linked_by,
    })
  }

  return {
    sobrevive: ganadora.id,
    seEliminan: unidades.filter(u => u.id !== ganadora.id).map(u => u.id).sort(),
    movimientos: movimientos.sort((a, b) => a.member_id.localeCompare(b.member_id)),
    integrantesFinales: [...porPersona.values()]
      .map(f => ({ member_id: f.member_id, relation: f.relation }))
      .sort((a, b) => a.member_id.localeCompare(b.member_id)),
  }
}

/**
 * Agrupa unidades que comparten al menos una persona, ENCADENANDO: si A comparte
 * con B y B con C, las tres van al mismo grupo. Devuelve solo los grupos de 2 o
 * más, que son los que hay que fusionar.
 */
export function gruposAFusionar(filas: readonly FilaFamilia[]): string[][] {
  // Union-find sobre las unidades, uniendo por persona compartida.
  const padre = new Map<string, string>()
  const raiz = (x: string): string => {
    let r = x
    while (padre.get(r) !== r) r = padre.get(r)!
    // Compresión de camino: sin esto, una cadena larga se recorre entera cada vez.
    let cur = x
    while (padre.get(cur) !== r) { const sig = padre.get(cur)!; padre.set(cur, r); cur = sig }
    return r
  }
  const unir = (a: string, b: string) => {
    const ra = raiz(a), rb = raiz(b)
    if (ra !== rb) padre.set(rb, ra)
  }

  for (const f of filas) if (!padre.has(f.family_unit_id)) padre.set(f.family_unit_id, f.family_unit_id)

  const unidadesPorPersona = new Map<string, string[]>()
  for (const f of filas) {
    const lista = unidadesPorPersona.get(f.member_id) ?? []
    lista.push(f.family_unit_id)
    unidadesPorPersona.set(f.member_id, lista)
  }
  for (const lista of unidadesPorPersona.values()) {
    for (let i = 1; i < lista.length; i++) unir(lista[0], lista[i])
  }

  const grupos = new Map<string, string[]>()
  for (const u of padre.keys()) {
    const r = raiz(u)
    const g = grupos.get(r) ?? []
    g.push(u)
    grupos.set(r, g)
  }
  return [...grupos.values()]
    .filter(g => g.length > 1)
    .map(g => [...g].sort())
    .sort((a, b) => a[0].localeCompare(b[0]))
}

/** Los cuatro casos de un vínculo, para que la UI pueda avisar ANTES de tocar
 *  nada — fusionar familias en silencio sorprende. */
export type CasoDeVinculo = 'crear' | 'sumar_a_una' | 'fusionar' | 'ya_vinculados'

export function casoDeVinculo(
  unidadDelOwner: string | null | undefined,
  unidadDelOtro: string | null | undefined,
): CasoDeVinculo {
  const a = unidadDelOwner || null
  const b = unidadDelOtro || null
  if (!a && !b) return 'crear'
  if (a && b && a === b) return 'ya_vinculados'
  if (a && b) return 'fusionar'
  return 'sumar_a_una'
}
