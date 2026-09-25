/**
 * EST-15 · Las preguntas que se hacen al matricular Nivel 1.
 *
 * Las trajo Ari desde el formulario que hoy vive en CCB (capturas del
 * 2026-09-24). Acá viven los TEXTOS EXACTOS y la regla que decide a quién se le
 * ofrece el estudio, en un solo lugar: el seed del formulario los usa para
 * crear los campos y la pantalla de matrícula para decidir el corte. Si
 * estuvieran duplicados, editar una opción rompería la regla en silencio.
 *
 * LO QUE HACE LA REGLA, en una línea: a quien es parte activa de una iglesia
 * evangélica Y quiere seguir en ella, no se le oculta nada ni se le reta — se
 * le explica a quién están dirigidos estos recursos y se le ofrece el material
 * para su propia iglesia.
 */

/** El formulario se resuelve por TÍTULO, no por un uuid escrito a mano: así el
 *  seed y el endpoint no se pueden desincronizar sin que falle el mismo día. */
export const TITULO_DEL_FORMULARIO = 'Matrícula a Nivel 1 — preguntas iniciales'

/** Cada pregunta se referencia por su ETIQUETA. No hay columna de clave estable
 *  en `form_fields`, así que la etiqueta es el identificador — y por eso vive
 *  acá como constante y no escrita a mano en dos lados. */
export const PREGUNTAS = {
  comoEscuchaste: '¿Cómo escuchaste sobre Theos Place?',
  asisteAIglesia: '¿Asistes a alguna iglesia regularmente?',
  queTeMotiva: '¿Qué te motiva a buscar los Estudios Bíblicos de Theos Place?',
  ofreceCasa: '¿Podrías ofrecer tu casa u oficina para el estudio?',
  ubicacion: 'Ubicación',
} as const

export const OPCIONES_COMO_ESCUCHASTE = [
  'Amigos', 'Familiares', 'Redes sociales', 'Televisión', 'Otro',
] as const

/**
 * OJO CON EL ACENTO: dice «Evángelica», no «Evangélica».
 *
 * Es como está escrito en el formulario de Ari, y como la regla que lo
 * referencia. Se copia TAL CUAL a propósito: la comparación es por texto
 * exacto, así que «arreglar» la tilde acá sin arreglarla en el mismo momento en
 * la opción dejaría la regla sin efecto y a nadie le aparecería el mensaje.
 * Si se corrige, se corrige en esta constante y listo — los dos usos salen de
 * acá.
 */
export const IGLESIA_EVANGELICA = 'Sí, Evángelica'

export const OPCIONES_ASISTE_A_IGLESIA = [
  'Asisto a Theos Place',
  IGLESIA_EVANGELICA,
  'Sí, Católica',
  'Sí, de otra religión',
  'No, ninguna',
] as const

/** La respuesta que dispara el mensaje: quiere el estudio para seguir en su
 *  iglesia, no para acercarse a Theos. */
export const QUIERE_SEGUIR_EN_SU_IGLESIA = 'Quería unirme a los estudios y continuar en mi iglesia'

export const OPCIONES_QUE_TE_MOTIVA = [
  'Estoy considerando unirme a Theos',
  'Mi iglesia no da ningún curso de Discipulado',
  QUIERE_SEGUIR_EN_SU_IGLESIA,
] as const

export const TITULO_OTRAS_OPCIONES = '¡Exploremos otras opciones!'

export const MENSAJE_OTRAS_OPCIONES = `¡Hola! Muchas gracias por querer unirte a nuestros grupos de Estudio Bíblico. Sin embargo, te contamos que nuestros recursos son limitados y están dirigidos exclusivamente a personas que:

• No son parte activa de una iglesia
• Están buscando un cambio de su iglesia actual
• Están en una iglesia donde no se les enseña/motiva personalmente a leer la Biblia

Ahora, nos alegra mucho que seas parte activa de una iglesia y que estés creciendo personalmente con el Señor. Si te gustaría usar nuestro material de Estudios Bíblicos en tu iglesia, ¡podés contactarnos al 7261-1001 y conversamos al respecto!`

export type RespuestasDelCuestionario = Record<string, string | string[] | number | null | undefined>

const texto = (r: RespuestasDelCuestionario[string]): string =>
  Array.isArray(r) ? (r[0] ?? '') : String(r ?? '')

/**
 * ¿Se le muestra «Exploremos otras opciones» y se le oculta Matricular?
 *
 * LAS DOS CONDICIONES VAN CON «Y», y esto es lo único que las capturas dejaban
 * ambiguo: en el formulario de Ari la sección tiene DOS reglas «Only show this
 * section if…» apiladas, una por cada pregunta, y un constructor de formularios
 * puede combinarlas con «y» o con «o» según la herramienta.
 *
 * Va con «Y» por dos razones. La primera es el texto del mensaje: dice «nos
 * alegra mucho que seas parte activa de una iglesia», o sea que está escrito
 * para quien eligió seguir en la suya — con «o», le saldría también a quien
 * contestó «estoy considerando unirme a Theos», que es exactamente a quien SÍ
 * se quiere recibir. La segunda es que no cambia nada en la práctica: la
 * pregunta de motivación solo aparece si ya contestó «evangélica», así que su
 * respuesta implica la otra. Con «Y» el resultado es el mismo y no depende de
 * ese encadenamiento.
 */
export function debeExplorarOtrasOpciones(r: RespuestasDelCuestionario): boolean {
  return texto(r[PREGUNTAS.asisteAIglesia]) === IGLESIA_EVANGELICA
    && texto(r[PREGUNTAS.queTeMotiva]) === QUIERE_SEGUIR_EN_SU_IGLESIA
}

/**
 * ¿Ya se puede matricular?
 *
 * Exige que las preguntas VISIBLES estén contestadas, no todas: quien no es
 * evangélico nunca ve la de motivación, y pedírsela lo dejaría trabado en un
 * campo que no existe.
 */
export function faltaResponder(r: RespuestasDelCuestionario): string[] {
  const falta: string[] = []
  const asiste = texto(r[PREGUNTAS.asisteAIglesia])
  if (!texto(r[PREGUNTAS.comoEscuchaste])) falta.push(PREGUNTAS.comoEscuchaste)
  if (!asiste) falta.push(PREGUNTAS.asisteAIglesia)
  if (asiste === IGLESIA_EVANGELICA && !texto(r[PREGUNTAS.queTeMotiva])) {
    falta.push(PREGUNTAS.queTeMotiva)
  }
  return falta
}

export type VeredictoDelCuestionario =
  | { estado: 'incompleto'; falta: string[] }
  | { estado: 'otras_opciones'; titulo: string; mensaje: string }
  | { estado: 'puede_matricular' }

/**
 * El veredicto completo, que es lo que la pantalla consume.
 *
 * El orden importa: primero «incompleto», porque con la pregunta de motivación
 * sin contestar todavía no se sabe nada, y mostrar el mensaje de despedida ahí
 * sería adelantarse.
 */
export function veredicto(r: RespuestasDelCuestionario): VeredictoDelCuestionario {
  const falta = faltaResponder(r)
  if (falta.length > 0) return { estado: 'incompleto', falta }
  if (debeExplorarOtrasOpciones(r)) {
    return { estado: 'otras_opciones', titulo: TITULO_OTRAS_OPCIONES, mensaje: MENSAJE_OTRAS_OPCIONES }
  }
  return { estado: 'puede_matricular' }
}

// ─── La FORMA del formulario ─────────────────────────────────────────────────

/**
 * Los campos y sus condiciones, tal como quedan en `form_fields`.
 *
 * Viven acá y no en el script del seed por una razón concreta: así el test los
 * corre contra `campoVisible`, el MISMO motor que usa la pantalla, en vez de
 * comprobar que un JSON tenga las llaves que uno espera. La ramificación de
 * este formulario es su parte delicada —lo que Ari pidió mirar con cuidado— y
 * verificarla contra el motor de verdad es la única forma de saber que
 * ramifica bien.
 *
 * Los ids entran como parámetro porque una condición apunta al `field_id` del
 * campo del que depende: el seed pasa uuids nuevos y el test, ids legibles.
 */
export type IdsDelCuestionario = {
  comoEscuchaste: string
  asisteAIglesia: string
  queTeMotiva: string
  otrasOpciones: string
  ofreceCasa: string
  ubicacion: string
}

export type CampoDelCuestionario = {
  id: string
  field_type: string
  label: string
  description?: string
  is_required?: boolean
  options?: readonly string[]
  conditions?: Array<{
    id: string
    action: 'show' | 'hide'
    condition_operator: 'AND' | 'OR'
    conditions: Array<{ id: string; field_id: string; operator: string; value: string }>
  }>
}

export function camposDelCuestionario(
  id: IdsDelCuestionario,
  nuevoId: () => string,
): CampoDelCuestionario[] {
  const regla = (
    condition_operator: 'AND' | 'OR',
    conds: Array<{ field_id: string; operator: string; value: string }>,
  ) => ({
    id: nuevoId(),
    action: 'show' as const,
    condition_operator,
    conditions: conds.map(c => ({ id: nuevoId(), ...c })),
  })

  return [
    {
      id: id.comoEscuchaste,
      field_type: 'select',
      label: PREGUNTAS.comoEscuchaste,
      description: 'Cuéntanos cómo escuchaste de nosotros por primera vez.',
      is_required: true,
      options: OPCIONES_COMO_ESCUCHASTE,
    },
    {
      id: id.asisteAIglesia,
      field_type: 'select',
      label: PREGUNTAS.asisteAIglesia,
      is_required: true,
      options: OPCIONES_ASISTE_A_IGLESIA,
    },
    {
      id: id.queTeMotiva,
      field_type: 'radio',
      label: PREGUNTAS.queTeMotiva,
      description: 'Si sos parte activa de tu iglesia, cuéntanos un poco de porqué te gustaría llevar un estudio bíblico con nosotros.',
      is_required: true,
      options: OPCIONES_QUE_TE_MOTIVA,
      conditions: [regla('AND', [
        { field_id: id.asisteAIglesia, operator: 'eq', value: IGLESIA_EVANGELICA },
      ])],
    },
    {
      // LAS DOS CONDICIONES EN UNA SOLA REGLA, CON «Y». En CCB son dos reglas
      // apiladas, y acá dos reglas se resuelven con «o» —gana la primera que se
      // cumple—. Con «o» el mensaje le saldría a cualquier evangélico, incluido
      // el que contestó «estoy considerando unirme a Theos». El porqué completo
      // está en `debeExplorarOtrasOpciones`.
      id: id.otrasOpciones,
      field_type: 'info',
      label: TITULO_OTRAS_OPCIONES,
      description: MENSAJE_OTRAS_OPCIONES,
      conditions: [regla('AND', [
        { field_id: id.asisteAIglesia, operator: 'eq', value: IGLESIA_EVANGELICA },
        { field_id: id.queTeMotiva, operator: 'eq', value: QUIERE_SEGUIR_EN_SU_IGLESIA },
      ])],
    },
    {
      // `neq` sobre una respuesta EN BLANCO da true, y es lo correcto: quien no
      // es evangélico nunca ve la pregunta de motivación y igual tiene que
      // poder ofrecer su casa.
      id: id.ofreceCasa,
      field_type: 'radio',
      label: PREGUNTAS.ofreceCasa,
      description: 'El lugar debe contar con espacio para unas 11 personas y un lugar seguro para dejar los carros.',
      is_required: true,
      options: ['Sí', 'No'],
      conditions: [regla('AND', [
        { field_id: id.queTeMotiva, operator: 'neq', value: QUIERE_SEGUIR_EN_SU_IGLESIA },
      ])],
    },
    {
      id: id.ubicacion,
      field_type: 'text',
      label: PREGUNTAS.ubicacion,
      description: '¡Gracias por ofrecer tu casa! Por favor, danos la dirección exacta. También puedes poner la ubicación en Waze.',
      is_required: true,
      conditions: [regla('AND', [
        { field_id: id.ofreceCasa, operator: 'eq', value: 'Sí' },
      ])],
    },
  ]
}
