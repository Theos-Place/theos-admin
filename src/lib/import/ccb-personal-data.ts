/**
 * Normalización de datos personales que llegan de un export de CCB.
 *
 * Vive acá y no dentro del script porque esto ESCRIBE sobre el padrón: 700 fichas
 * de personas reales. Un normalizador con un caso mal pensado (un teléfono español
 * convertido en 8 dígitos, una cédula alfanumérica destrozada) deja datos malos que
 * después nadie sabe de dónde salieron. Con tests se ve qué hace en cada caso.
 */

/** Sin tildes, minúscula, espacios colapsados. Igual que el resto de los importadores. */
export const norm = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

// ─── Teléfono ────────────────────────────────────────────────────────────────

export type PhoneResult =
  | { ok: true; value: string; changed: 'espacios' | 'ninguno' }
  /** Se conserva tal cual (limpio de espacios sobrantes) porque no es un número CR. */
  | { ok: true; value: string; changed: 'internacional' }
  | { ok: false }

/**
 * El padrón guarda los teléfonos CR como 8 dígitos pegados (966 de ~1000 hoy), y
 * CCB los exporta como "8309 4310".
 *
 * OJO con los internacionales: el CSV trae números españoles tipo
 * "00 34 616 98 52 56". Pegarlos daría un "003461698525 6" sin sentido y perdería
 * el número. Esos se dejan como vienen, solo con los espacios colapsados.
 */
export function normalizePhone(raw?: string | null): PhoneResult {
  const v = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!v) return { ok: false }
  const soloDigitos = v.replace(/[\s()-]/g, '')
  // Número CR: 8 dígitos. Con o sin el +506 adelante.
  if (/^\d{8}$/.test(soloDigitos)) {
    return { ok: true, value: soloDigitos, changed: soloDigitos === v ? 'ninguno' : 'espacios' }
  }
  if (/^(\+?506)\d{8}$/.test(soloDigitos)) {
    return { ok: true, value: soloDigitos.slice(-8), changed: 'espacios' }
  }
  return { ok: true, value: v, changed: 'internacional' }
}

// ─── Cédula / documento ──────────────────────────────────────────────────────

export type DocResult =
  | { ok: false }
  | {
      ok: true
      /** Valor a guardar en cedula y cedula_normalized (el padrón los tiene iguales). */
      value: string
      /** Forma del documento, para poder reportar los que no son cédula CR. */
      kind: 'cr_9' | 'dimex' | 'alfanumerico' | 'otro_numerico'
      changed: boolean
    }

/**
 * Quita guiones y espacios y pasa a mayúscula — exactamente lo que hoy tiene
 * cedula_normalized en el padrón (verificado: 0 filas donde no coincida).
 *
 * El CSV trae de todo: 536 cédulas CR de 9 dígitos, DIMEX de 12, documentos
 * extranjeros alfanuméricos (Y5470880E) y uno con guiones (1-1324-0329). Los
 * alfanuméricos se respetan tal cual: destrozarlos sería peor que no tenerlos.
 */
export function normalizeDoc(raw?: string | null): DocResult {
  const v = (raw ?? '').trim()
  if (!v) return { ok: false }
  const limpio = v.replace(/[\s-]/g, '').toUpperCase()
  if (!limpio) return { ok: false }
  const kind: 'cr_9' | 'dimex' | 'alfanumerico' | 'otro_numerico' =
    /^\d{9}$/.test(limpio) ? 'cr_9'
    : /^\d{12}$/.test(limpio) ? 'dimex'
    : /[A-Z]/.test(limpio) ? 'alfanumerico'
    : 'otro_numerico'
  return { ok: true, value: limpio, kind, changed: limpio !== v }
}

// ─── Textos libres ───────────────────────────────────────────────────────────

/**
 * Un valor del CSV que sirve para escribir, o null.
 *
 * "0" cuenta como vacío: 328 filas traen 0 en Dedicacion y es basura del export,
 * no la ocupación de nadie.
 */
export function cleanText(raw?: string | null, treatAsEmpty: string[] = []): string | null {
  const v = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!v) return null
  if (treatAsEmpty.includes(v)) return null
  return v
}

export const cleanOccupation = (raw?: string | null) => cleanText(raw, ['0'])

// ─── Nota de Panorama ────────────────────────────────────────────────────────

export type NotaResult =
  | { kind: 'numero'; value: number; /** No cabe en numeric(4,2) (máx 99.99). */ excedeColumna: boolean }
  | { kind: 'reprobado' }
  | { kind: 'sin_registro' }
  | { kind: 'texto'; value: string }
  | { kind: 'vacio' }

/**
 * Interpreta la columna "Nota Panorama". No escribe nada: clasifica para el reporte.
 *
 * El CSV mezcla números con punto (92.3), números con COMA decimal (90,7), textos
 * ("reprobo", "no hay registro de nota", "no hay info, dirigente") y notas por
 * encima de 100 (105.2), que no caben en study_enrollments.grade — numeric(4,2)
 * llega hasta 99.99.
 */
export function parseNotaPanorama(raw?: string | null): NotaResult {
  const v = (raw ?? '').trim()
  if (!v) return { kind: 'vacio' }
  const n = norm(v)
  if (n.startsWith('reprob')) return { kind: 'reprobado' }
  if (n.includes('no hay registro')) return { kind: 'sin_registro' }
  // Coma decimal: "90,7" es 90.7, no 907.
  const num = Number(v.replace(',', '.'))
  if (Number.isFinite(num)) return { kind: 'numero', value: num, excedeColumna: num > 99.99 }
  return { kind: 'texto', value: v }
}

// ─── Match difuso contra el catálogo de puestos ──────────────────────────────

/** Bigramas de una cadena normalizada, para el coeficiente de Dice. */
function bigrams(s: string): Set<string> {
  const out = new Set<string>()
  const t = s.replace(/ /g, '')
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2))
  return out
}

/** ¿`corta` aparece como palabra completa dentro de `larga`? */
function contienePalabra(larga: string, corta: string): boolean {
  if (!corta || corta.length < 4) return false
  return new RegExp(`(^| )${corta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(larga)
}

/**
 * Similitud 0–1 (Dice sobre bigramas). 1 = igual tras normalizar.
 *
 * Con Dice solo, "Oracion" contra "Comité de Oración" da 0.60 — castigado por el
 * largo del otro lado, aunque sea claramente el puesto correcto. Cuando uno
 * contiene al otro como palabra completa, el piso sube a 0.85: para el CSV de
 * mapeo es una sugerencia buenísima y así no se hunde entre el ruido.
 */
export function similarity(a: string, b: string): number {
  const A = norm(a), B = norm(b)
  if (!A || !B) return 0
  if (A === B) return 1
  const ba = bigrams(A), bb = bigrams(B)
  if (!ba.size || !bb.size) return 0
  let comunes = 0
  for (const g of ba) if (bb.has(g)) comunes++
  const dice = (2 * comunes) / (ba.size + bb.size)
  const contenido = contienePalabra(A, B) || contienePalabra(B, A)
  return contenido ? Math.max(dice, 0.85) : dice
}

export type CatalogEntry = { label: string; kind: 'puesto' | 'comite' | 'area'; area?: string | null; id: string }
export type FuzzyMatch = { entry: CatalogEntry | null; score: number }

/**
 * Mejor coincidencia del texto libre contra el catálogo real.
 *
 * Se compara contra el nombre del puesto Y contra "puesto + área": el catálogo
 * tiene decenas de "Colaborador" y "Encargado de comité" repetidos por área, así
 * que el título solo no alcanza para decidir nada.
 */
export function bestMatch(text: string, catalog: CatalogEntry[]): FuzzyMatch {
  let mejor: FuzzyMatch = { entry: null, score: 0 }
  let mejorLabel = 0
  for (const e of catalog) {
    const sLabel = similarity(text, e.label)
    // Las formas compuestas pesan un poco menos que el nombre propio: si no, para
    // el texto "Oración" cualquier puesto del comité de Oración empataría con el
    // comité mismo, y el orden del catálogo decidiría — o sea, al azar.
    const s = Math.max(
      sLabel,
      e.area ? similarity(text, `${e.label} ${e.area}`) * 0.95 : 0,
      e.area ? similarity(text, e.area) * 0.9 : 0,
    )
    // Desempate explícito y estable: primero quién se parece más por nombre
    // propio, después el puesto concreto antes que el comité.
    // s > 0 obligatorio: sin esto, cuando NADA se parecía, el desempate igual
    // elegía el primer puesto del catálogo y devolvía una sugerencia con score
    // 0.00. Una sugerencia falsa es peor que ninguna — el que revisa la creería.
    const gana = s > 0 && (
      s > mejor.score
      || (s === mejor.score && sLabel > mejorLabel)
      || (s === mejor.score && sLabel === mejorLabel && e.kind === 'puesto' && mejor.entry?.kind !== 'puesto')
    )
    if (gana) { mejor = { entry: e, score: s }; mejorLabel = sLabel }
  }
  return mejor
}

/** Separa una celda con varios servicios ("Worship, Oración") en items. */
export function splitServices(cell?: string | null): string[] {
  return (cell ?? '').split(/[,;/]|\band\b|\+/)
    .map(s => s.trim())
    .filter(Boolean)
}

/** La sede que menciona el texto, si menciona alguna. */
export function detectSede(text: string, sedeNames: string[]): string | null {
  const t = norm(text)
  let mejor: string | null = null
  for (const s of sedeNames) {
    const n = norm(s)
    if (!n) continue
    // Palabra completa: "este" no debe pegar dentro de "oeste".
    if (new RegExp(`(^| )${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(t)) {
      if (!mejor || n.length > norm(mejor).length) mejor = s
    }
  }
  return mejor
}
