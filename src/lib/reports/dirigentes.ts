// DIR-7 · Pulso del cuerpo de dirigentes. Módulo PURO: recibe filas crudas y
// arma el payload que se cachea en report_snapshots.
//
// DOS COSAS QUE PARECEN LA MISMA Y NO LO SON. La ficha pedía "personas
// capacitadas para dar cada tipo de estudio, de study_leaders.qualified_study_codes",
// pero en este esquema esas son dos columnas distintas y la UI ya las nombra
// distinto (ver useDirigentes):
//   · formation_study_codes → FORMACIÓN: para qué está capacitado.
//   · qualified_study_codes  → DISPONIBILIDAD: qué está dispuesto a dar ahora.
// Se reportan LAS DOS. Son una línea de código cada una y la diferencia es
// justamente lo que el coordinador necesita ver: alguien capacitado en N3 que no
// lo tiene en disponibilidad es capacidad que existe y no está ofrecida.
//
// SOLAPES, dichos de frente: un dirigente puede tener varios códigos y varias
// zonas, así que las filas de `capacitados`, `disponibles` y `por_zona` NO suman
// el total — cada una cuenta personas por categoría. Los cinco buckets de
// `estado` sí son excluyentes y sí suman el total (hay un test que lo verifica).

export type LeaderRow = {
  member_id: string
  is_active: boolean
  availability_status: string | null
  /** Para qué está capacitado. */
  formation_study_codes: string[] | null
  /** Qué está dispuesto a dar ahora. */
  qualified_study_codes: string[] | null
  zone_preference: string[] | null
}

/** Un grupo ABIERTO (en_matricula o en_curso) y quién lo lleva. */
export type ActiveGroupRow = {
  leader_id: string | null
  co_leader_id: string | null
}

export type PlanRow = { code: string; name: string }

/** Un punto histórico, para la evolución. */
export type LeaderHistoryPoint = {
  captured_on: string
  activos: number
  dando_ahora: number
  disponibles_sin_grupo: number
}

export type PorEstudio = { code: string; name: string; total: number }

export type PorZona = {
  zona: string
  activos: number
  dando_ahora: number
  disponibles_sin_grupo: number
}

export type DirigentesReport = {
  /** Total de designados en study_leaders (histórico incluido). */
  total: number
  /** is_active — el titular. Distinto de los buckets: un activo puede estar
   *  dando o disponible. */
  activos: number

  // ── Buckets EXCLUYENTES: suman `total` ──────────────────────────────────────
  dando_ahora: number
  disponibles_sin_grupo: number
  en_pausa: number
  en_revision: number
  inactivos: number

  /** CALIDAD DE DATOS, no una métrica del cuerpo de dirigentes. Las dos salen de
   *  cruzar los grupos abiertos contra study_leaders, y las dos contradicen
   *  EST-1 ("nunca un dirigente inactivo con grupo activo"): si no se muestran,
   *  no hay dónde verlas. */
  dando_sin_ficha: number
  dando_inactivos: number

  capacitados: PorEstudio[]
  disponibles_por_estudio: PorEstudio[]
  por_zona: PorZona[]
  evolucion: {
    hace_3_meses: LeaderHistoryPoint | null
    hace_6_meses: LeaderHistoryPoint | null
  }
}

const SIN_ZONA = 'Sin zona declarada'

function codes(v: string[] | null | undefined): string[] {
  return Array.isArray(v) ? v.filter(Boolean) : []
}

/** Cuenta personas por código de estudio, sobre la columna que se le pase. */
function porEstudio(
  leaders: readonly LeaderRow[],
  pick: (l: LeaderRow) => string[] | null,
  plans: readonly PlanRow[],
): PorEstudio[] {
  const nombre = new Map(plans.map(p => [p.code, p.name]))
  const conteo = new Map<string, number>()
  for (const l of leaders) {
    // Un dirigente con el mismo código repetido cuenta UNA vez.
    for (const c of new Set(codes(pick(l)))) {
      conteo.set(c, (conteo.get(c) ?? 0) + 1)
    }
  }
  return [...conteo.entries()]
    .map(([code, total]) => ({ code, name: nombre.get(code) ?? code, total }))
    // De mayor a menor: lo primero que se busca es dónde hay más y dónde falta.
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code, 'es'))
}

export function buildDirigentesReport(
  leaders: readonly LeaderRow[],
  activeGroups: readonly ActiveGroupRow[],
  plans: readonly PlanRow[],
  history: readonly LeaderHistoryPoint[] = [],
  today: string = new Date().toISOString().slice(0, 10),
): DirigentesReport {
  // Quién lleva un grupo abierto AHORA. Cuenta el co-dirigente igual que el
  // dirigente: los dos están dando el estudio.
  const conGrupo = new Set<string>()
  for (const g of activeGroups) {
    if (g.leader_id) conGrupo.add(g.leader_id)
    if (g.co_leader_id) conGrupo.add(g.co_leader_id)
  }

  const porId = new Map(leaders.map(l => [l.member_id, l]))
  // Lleva un grupo abierto y no tiene ficha en study_leaders: no aparece en
  // ningún bucket porque el reporte recorre study_leaders, así que se cuenta
  // aparte para que no quede invisible.
  let sinFicha = 0
  for (const m of conGrupo) if (!porId.has(m)) sinFicha++

  let dando = 0, disponibles = 0, pausa = 0, revision = 0, inactivos = 0, activos = 0
  let dandoInactivos = 0

  // Clasificación en un solo lugar, para que los buckets no se puedan
  // contradecir entre el total y el desglose por zona.
  const bucketDe = (l: LeaderRow): 'dando' | 'disponible' | 'pausa' | 'revision' | 'inactivo' => {
    // Dar un estudio manda sobre todo lo demás: es un hecho observable, no una
    // configuración. Si alguien aparece con grupo abierto y en pausa, el dato
    // que importa es que está dando.
    if (conGrupo.has(l.member_id)) return 'dando'
    if (l.availability_status === 'en_revision') return 'revision'
    if (l.availability_status === 'resting') return 'pausa'
    if (l.is_active) return 'disponible'
    return 'inactivo'
  }

  const zonas = new Map<string, PorZona>()
  const zonaDe = (nombre: string): PorZona => {
    if (!zonas.has(nombre)) {
      zonas.set(nombre, { zona: nombre, activos: 0, dando_ahora: 0, disponibles_sin_grupo: 0 })
    }
    return zonas.get(nombre)!
  }

  for (const l of leaders) {
    if (l.is_active) activos++
    const b = bucketDe(l)
    if (b === 'dando') {
      dando++
      if (!l.is_active) dandoInactivos++
    }
    else if (b === 'disponible') disponibles++
    else if (b === 'pausa') pausa++
    else if (b === 'revision') revision++
    else inactivos++

    // Por zona solo interesa quien está en juego (activo): un inactivo con
    // preferencia de zona no es capacidad disponible en esa zona.
    if (!l.is_active) continue
    const suyas = new Set(codes(l.zone_preference))
    for (const z of suyas.size > 0 ? suyas : new Set([SIN_ZONA])) {
      const acc = zonaDe(z)
      acc.activos++
      if (b === 'dando') acc.dando_ahora++
      if (b === 'disponible') acc.disponibles_sin_grupo++
    }
  }

  return {
    total: leaders.length,
    activos,
    dando_ahora: dando,
    disponibles_sin_grupo: disponibles,
    en_pausa: pausa,
    en_revision: revision,
    inactivos,
    dando_sin_ficha: sinFicha,
    dando_inactivos: dandoInactivos,
    capacitados: porEstudio(leaders, l => l.formation_study_codes, plans),
    disponibles_por_estudio: porEstudio(leaders, l => l.qualified_study_codes, plans),
    por_zona: [...zonas.values()].sort((a, b) => b.activos - a.activos || a.zona.localeCompare(b.zona, 'es')),
    evolucion: {
      hace_3_meses: nearestPoint(history, today, 3),
      hace_6_meses: nearestPoint(history, today, 6),
    },
  }
}

/** Resta meses a una fecha YYYY-MM-DD, sin corrimientos de zona. */
export function monthsBefore(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  // Día 0 del mes siguiente = último día del mes objetivo: así un 31 no se
  // desborda al mes que viene (31 de marzo − 1 mes debe ser 28/29 de febrero).
  const ultimo = new Date(Date.UTC(y, m - months, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - months - 1, Math.min(d, ultimo))).toISOString().slice(0, 10)
}

/**
 * El punto histórico más cercano a "hace N meses".
 *
 * Tolerancia de 45 días: el cron puede no haber corrido justo ese día, y un
 * punto de hace 3 meses y 3 días sigue respondiendo la pregunta. Más lejos que
 * eso ya no, y devuelve null en vez de comparar contra algo que no toca —
 * mostrar "sin dato" es correcto; una tendencia inventada no.
 */
export const HISTORY_TOLERANCE_DAYS = 45

export function nearestPoint(
  history: readonly LeaderHistoryPoint[],
  today: string,
  monthsAgo: number,
): LeaderHistoryPoint | null {
  if (history.length === 0) return null
  const objetivo = monthsBefore(today, monthsAgo)
  const dist = (p: LeaderHistoryPoint) =>
    Math.abs(Date.parse(`${p.captured_on}T00:00:00Z`) - Date.parse(`${objetivo}T00:00:00Z`)) / 86400000
  let mejor: LeaderHistoryPoint | null = null
  for (const p of history) {
    if (dist(p) > HISTORY_TOLERANCE_DAYS) continue
    if (!mejor || dist(p) < dist(mejor)) mejor = p
  }
  return mejor
}

/**
 * DIR-6 · Colapsa los buckets administrativos para quien no los administra.
 *
 * "En pausa" y "en revisión" pasan a `inactivos`, igual que en la lista de
 * dirigentes. Se hace ACÁ y lo llama el API, para que el número no salga del
 * servidor: si el colapso viviera en la UI, el conteo real igual viajaría en el
 * JSON y bastaría abrir la pestaña de red.
 */
export function collapseAdminBuckets(r: DirigentesReport): DirigentesReport {
  return {
    ...r,
    inactivos: r.inactivos + r.en_pausa + r.en_revision,
    en_pausa: 0,
    en_revision: 0,
  }
}
