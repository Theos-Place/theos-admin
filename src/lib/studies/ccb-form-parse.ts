/**
 * Parseo del formulario CCB "EB — Fin de Capacitación" (módulo puro).
 *
 * Las listas de aprobados y reprobados son TEXTO LIBRE que llenó cada dirigente
 * a mano entre 2018 y 2026. Conviven en el mismo archivo:
 *
 *     Carlos Rojas 85              ← nota pegada, sin separador
 *     Alba Arguedas Sibaja - 100   ← nota con guion
 *     Tatiana Sancho-100           ← sin espacios
 *     1. Marianella Ampuero        ← enumerado, sin nota
 *     5. Luisa Quesada (Necesita pasantia para mejorar)
 *     Si todos vieron la charla    ← no es una persona
 *     NA / None / -
 *
 * Es EVIDENCIA, no un archivo importable: la salida de acá se ofrece para que
 * alguien la apruebe, nunca para escribir sola.
 */

/** Sin tildes, minúsculas, espacios colapsados. Mismo criterio que el resto de
 *  los importadores del repo. */
export function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Palabras que NUNCA aparecen en un nombre y sí en las frases coladas.
 *
 * Las partículas de apellido (de, la, del, los, san…) quedan FUERA a propósito:
 * "Ana de la Cruz" es un nombre real y descartarlo perdería a la persona.
 */
const NO_ES_NOMBRE = new Set([
  'na', 'n/a', 'none', 'ninguno', 'ninguna', 'nadie', 'no', 'si', 'sí',
  'todos', 'todas', 'vieron', 'ver', 'aplica', 'charla', 'curso', 'grupo',
  'aprobaron', 'reprobaron', 'nota', 'notas', 'falta', 'faltan', 'pendiente',
  'estudiantes', 'alumnos', 'participantes', 'personas', 'lista', 'ok',
])

export type PersonaCruda = {
  /** Nombre limpio, como quedó tras quitar numeración, nota y paréntesis. */
  nombre: string
  /**
   * Lecturas posibles del nombre, para que el match contra members decida.
   *
   * El archivo mezcla "Nombre Apellido" con el formato invertido de CCB
   * ("Vargas Rodriguez, Maria Emilia"), y sintácticamente son indistinguibles
   * de una línea con dos personas ("Aniri Herrera, Marcia Solano"). En vez de
   * adivinar, se ofrecen las dos lecturas y gana la que exista en la base; si
   * existen las dos, el caso se marca ambiguo.
   */
  variantes: string[]
  /** Nota SOLO si se pudo leer sin ambigüedad; si no, null. */
  nota: number | null
  /** Lo que se descartó al leer la nota ("9.0": ¿escala 0-10 o 0-100?). */
  notaAmbigua: string | null
  /** Observación del dirigente: paréntesis, o el texto después de un guion. */
  observacion: string | null
  /** La línea tal cual, para poder auditar cualquier decisión de acá. */
  crudo: string
}

export type ListaParseada = {
  personas: PersonaCruda[]
  /** Líneas que no parecen una persona. Se reportan, no se tiran en silencio. */
  descartadas: string[]
}

/** "Vargas Rodriguez, Maria Emilia" → "Maria Emilia Vargas Rodriguez". */
export function nombreDerecho(s: string): string {
  const i = s.indexOf(',')
  if (i < 0) return s.trim()
  return `${s.slice(i + 1).trim()} ${s.slice(0, i).trim()}`.replace(/\s+/g, ' ').trim()
}

/** ¿El texto limpio parece el nombre de una persona? */
function pareceNombre(limpio: string): boolean {
  if (!limpio) return false
  if (/\d/.test(limpio)) return false
  const tokens = norm(limpio.replace(/,/g, ' ')).split(' ').filter(Boolean)
  if (tokens.length < 2 || tokens.length > 6) return false
  if (tokens.some(t => NO_ES_NOMBRE.has(t))) return false
  // Solo letras, apóstrofos y guiones (D'Angelo, Vargas-Mora).
  return tokens.every(t => /^[a-zñ'’-]+$/.test(t))
}

/**
 * Lee la nota del final de la línea. Devuelve el resto del texto y la nota.
 *
 * DOS ESCALAS conviven en el archivo y no se pueden mezclar: unos dirigentes
 * califican de 0 a 100 ("Isaac León 78.54") y otros de 0 a 10 ("Alejandro Egea
 * - 9.0"). Un 9.0 puede ser un 9 o un 90 y no hay forma de saberlo desde la
 * línea, así que ese caso deja `nota: null` y guarda el texto en `notaAmbigua`.
 * Perder la nota cuesta un dato; inventarla deja una calificación equivocada en
 * el expediente de alguien.
 */
function leerNota(t: string): { resto: string; nota: number | null; ambigua: string | null } {
  // Separador explícito (- 100, -90,75, : 85) o número pegado al final del
  // nombre, con o sin espacio ("Milena Vargas 92,5", "Acon Chaves, Melissa97").
  const m = t.match(/^(.*?[a-zA-ZñÑáéíóúÁÉÍÓÚ.,'’-])\s*(?:[-–—:]\s*)?(\d{1,3}(?:[.,]\d{1,2})?)\s*$/)
  if (!m) return { resto: t, nota: null, ambigua: null }
  const crudo = m[2]
  const v = Number(crudo.replace(',', '.'))
  const resto = m[1].replace(/[-–—:\s]+$/, '')
  if (!Number.isFinite(v) || v < 0 || v > 100) return { resto, nota: null, ambigua: crudo }
  // Escala indistinguible: cualquier valor <= 10. Se mira el TEXTO y no el
  // número, porque Number('9.0') es 9 y pasaría por entero — pero "9.0" está
  // escrito en escala 0-10 y vale 90, o 9, según quién lo escribió.
  if (v <= 10) return { resto, nota: null, ambigua: crudo }
  return { resto, nota: v, ambigua: null }
}

/**
 * Una línea → una persona, o null si no lo es.
 *
 * No resuelve la inversión con coma: entrega las dos lecturas en `variantes` y
 * deja que el match contra members decida (ver PersonaCruda.variantes).
 */
export function parsearLinea(linea: string): PersonaCruda | null {
  const crudo = linea.trim()
  if (!crudo) return null
  let t = crudo

  // 1) numeración inicial: "1.", "1)", "1 -", "5 "
  t = t.replace(/^\s*\d{1,2}\s*[.)\-–]?\s+/, '').replace(/^\s*\d{1,2}\s*[.)]\s*/, '')

  // 2) paréntesis: es observación, nunca nota
  let observacion: string | null = null
  const par = t.match(/\(([^)]*)\)/)
  if (par) { observacion = par[1].trim() || null; t = t.replace(/\([^)]*\)/g, ' ') }

  // 3) nota al final
  const { resto, nota, ambigua } = leerNota(t.replace(/\s+/g, ' ').trim())
  t = resto

  // 4) comentario después de un guion CON espacios ("Karla Ávila- dejó el curso
  //    por temas de salud"). Se exige el espacio para no partir "Vargas-Mora".
  const guion = t.match(/^(.*?[a-zA-ZñÑáéíóúÁÉÍÓÚ])\s*[-–—]\s+(\S.*)$/)
  if (guion) { observacion = observacion ?? guion[2].trim(); t = guion[1] }

  // 5) nombre y apellido pegados sin espacio ("NataliaBlanco"). Solo se parte
  //    en el salto minúscula→mayúscula DENTRO de una palabra; pareceNombre
  //    sigue siendo el filtro final.
  t = t.replace(/([a-zñáéíóú])([A-ZÑÁÉÍÓÚ])/g, '$1 $2')

  // 6) restos: puntuación final y el asterisco que algunos usan de marca
  t = t.replace(/[*]+/g, ' ').replace(/[-–—:;.]+\s*$/, '').replace(/\s+/g, ' ').trim()
  t = t.replace(/,\s*$/, '').trim()

  const comas = (t.match(/,/g) ?? []).length
  // Dos o más comas es una línea con VARIAS personas, no un nombre invertido.
  // No se parten acá: se descartan y se reportan, porque partirlas bien exige
  // decidir dónde termina cada nombre y eso ya es adivinar.
  if (comas >= 2) return null
  if (!pareceNombre(t)) return null

  const variantes = comas === 1 ? [nombreDerecho(t), t.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()] : [t]
  return { nombre: variantes[0], variantes, nota, notaAmbigua: ambigua, observacion, crudo }
}

/** Bloque de texto libre → personas + líneas descartadas. */
export function parsearLista(texto: string | null | undefined): ListaParseada {
  const personas: PersonaCruda[] = []
  const descartadas: string[] = []
  for (const linea of (texto ?? '').split(/\r?\n/)) {
    const l = linea.trim()
    if (!l) continue
    const p = parsearLinea(l)
    if (p) personas.push(p)
    else descartadas.push(l)
  }
  return { personas, descartadas }
}

/**
 * Nombre de la capacitación (texto libre) → código de plan.
 *
 * El campo lo escribe cada dirigente: hay 38 grafías distintas solo en
 * 2025-2026 ("Sirviendo como Jesus" sin tilde, "HErmenéutica", "Evagelismo",
 * "Admin del Dinero"). Se resuelve por patrón sobre el texto normalizado, y lo
 * que no calza se REPORTA — nunca se adivina el plan más parecido.
 */
const CAPACITACIONES: Array<[RegExp, string]> = [
  [/sirviendo como jesus|\bscj\b/, 'SCJ'],
  [/discipulos?\s*1/, 'DIS1'],
  [/discipulos?\s*2/, 'DIS2'],
  [/discipulos?\s*3/, 'DIS3'],
  [/panorama/, 'PAN'],
  [/pre\s*-?\s*matrimonial/, 'PREMAT'],
  [/hermeneutica|como interpretar la biblia/, 'HER'],
  [/religiones del mundo/, 'RDM'],
  [/administr\w*\s+(el\s+|del\s+)?dinero|admin\.?\s+del dinero/, 'AED'],
  [/\bcdeb\b|como dar estudios?( de biblia| biblicos)?/, 'CDEB'],
  [/como tomar buenas decisiones/, 'CTBD'],
  [/amor sin fronteras/, 'ASF'],
  [/evangelismo|evagelismo/, 'EVM'],
  [/\bhechos\b/, 'HCH'],
  [/\bhebreos\b/, 'HEB'],
  [/\bromanos\b/, 'ROM'],
  [/\bmatrimonios\b/, 'MAT'],
  [/adonde va este bus/, 'BUS'],
  [/\bevangelios\b/, 'EVA'],
  [/nivel\s*1|\bn1\b/, 'N1'], [/nivel\s*2|\bn2\b/, 'N2'],
  [/nivel\s*3|\bn3\b/, 'N3'], [/nivel\s*4|\bn4\b/, 'N4'],
]

export function capacitacionAPlan(texto: string | null | undefined): string | null {
  const n = norm(texto)
  if (!n) return null
  return CAPACITACIONES.find(([re]) => re.test(n))?.[1] ?? null
}
