/**
 * EST-22 · Quién ofreció su casa para el estudio.
 *
 * EL PROBLEMA. La matrícula a Nivel 1 pregunta «¿Podrías ofrecer tu casa u
 * oficina para el estudio?» y pide la ubicación. El dato se guarda —medido
 * el 2026-10-06: 30 respuestas, 5 que sí— y NADIE lo ve: vive en
 * `form_response_values` y no aparece en ninguna pantalla de estudios. Se
 * pregunta para armar los grupos y se usa cero.
 *
 * ES DE LA PERSONA, NO DE LA MATRÍCULA. `form_responses` guarda `member_id`
 * y nada más: no hay enrollment ni grupo. Tiene sentido —se pregunta una vez
 * al entrar, no en cada nivel— pero obliga a cruzar por persona y no por
 * matrícula, y a aceptar que alguien puede haber contestado dos veces
 * (Catalina Pagés lo hizo).
 *
 * QUIÉN LO VE: coordinación de estudios y admin, no el dirigente ni el
 * estudiante (Floriana, 2026-10-06). Con la ubicación incluida: sin ella el
 * dato no sirve para armar el grupo, que es para lo que se preguntó.
 *
 * Módulo PURO.
 */

/**
 * Cómo se reconoce la pregunta, y por qué así.
 *
 * No hay una llave estable: `form_fields` no tiene slug ni código, solo el
 * texto que alguien escribió. Se busca por el texto normalizado —sin tildes
 * ni mayúsculas— y por un NÚCLEO corto («ofrecer tu casa»), no por la
 * oración entera: si mañana alguien le agrega un signo o cambia «estudio»
 * por «grupo», el match aguanta.
 *
 * Si el día que cambien la pregunta esto deja de encontrarla, la columna
 * aparece vacía — no rota. Es el modo de fallo que se eligió: una columna
 * sin datos se nota y se arregla; una que muestra el dato de otra pregunta,
 * no.
 */
const NUCLEO_PREGUNTA = 'ofrecer tu casa'
const NUCLEO_UBICACION = 'ubicacion'

const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function esLaPreguntaDeLaCasa(label: string | null | undefined): boolean {
  return !!label && normalizar(label).includes(NUCLEO_PREGUNTA)
}

export function esElCampoDeUbicacion(label: string | null | undefined): boolean {
  return !!label && normalizar(label) === NUCLEO_UBICACION
}

/**
 * ¿La respuesta es un sí?
 *
 * Las opciones son «Sí» y «No», pero se acepta cualquier forma afirmativa:
 * el campo es texto libre en la base y un cambio de opciones no debería
 * convertir todos los síes en noes en silencio.
 */
export function ofreceCasa(respuesta: string | null | undefined): boolean {
  if (!respuesta) return false
  const r = normalizar(respuesta)
  return r === 'si' || r === 'sí' || r === 'yes' || r === 'true'
}

export type OfrecimientoDeCasa = {
  member_id: string
  /** Lo que escribió: una dirección, un link de Waze, lo que sea. */
  ubicacion: string | null
  /** Cuándo lo contestó, para quedarse con lo más reciente. */
  respondido: string
}

/**
 * De varias respuestas por persona, la que vale es la ÚLTIMA.
 *
 * Catalina Pagés contestó dos veces con direcciones distintas —la segunda
 * más corta— y mostrar las dos en la lista del grupo sería ruido. La más
 * reciente es la que la persona quiso dejar.
 */
export function ultimaPorPersona(
  filas: readonly OfrecimientoDeCasa[],
): Map<string, OfrecimientoDeCasa> {
  const m = new Map<string, OfrecimientoDeCasa>()
  for (const f of filas) {
    const previa = m.get(f.member_id)
    if (!previa || f.respondido > previa.respondido) m.set(f.member_id, f)
  }
  return m
}

/** Lo que se muestra en la celda. Vacío cuando no ofreció: una columna de
 *  «No» repetidos es ruido, y lo que se busca son los pocos que sí. */
export function etiquetaDeCasa(ofrece: boolean): string {
  return ofrece ? 'Ofrece casa' : ''
}
