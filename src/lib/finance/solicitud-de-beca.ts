/**
 * BEC-5 · Las reglas de la solicitud de beca (decididas con Meli 2026-09-29).
 *
 * POR QUÉ CAMBIA. Hoy la razón es texto libre y el destino es el TIPO de
 * estudio, no el grupo. Las 10 solicitudes reales de producción muestran los
 * dos problemas:
 *
 *  · Las razones escritas son siempre las mismas tres —«Estuve 4 meses sin
 *    trabajo», «voy a cumplir 1 año sin trabajo», «mi situación económica»—
 *    pero cada quien las cuenta distinto, así que no se pueden contar ni
 *    filtrar. Meli aprueba solo por tres motivos; que el formulario los diga
 *    le ahorra leer diez párrafos para clasificar.
 *  · Una de las diez dice textualmente: «la había solicitado para Romanos
 *    pero ya está lleno». Pedir por TIPO de estudio y no por grupo obliga a
 *    esa conversación, y cuando el grupo se llena la solicitud se cae.
 *
 * Módulo PURO: define y valida. Las pantallas y los endpoints lo usan.
 */

// ── 1 · Las tres razones ────────────────────────────────────────────────────

/**
 * Las ÚNICAS tres por las que se aprueba una beca.
 *
 * El orden importa y no es alfabético: «situación socioeconómica» va de
 * último a propósito. Es la más amplia y la que todo el mundo elegiría si
 * apareciera primero; puesta al final, quien tiene un motivo concreto lo
 * marca y la lista sirve para algo.
 */
export const RAZONES_DE_BECA = ['desempleo', 'salud', 'socioeconomica'] as const
export type RazonDeBeca = (typeof RAZONES_DE_BECA)[number]

export const RAZON_LABEL: Record<RazonDeBeca, string> = {
  desempleo: 'Desempleo',
  salud: 'Situación de salud',
  socioeconomica: 'Situación socioeconómica',
}

export const LEYENDA_DE_RAZONES = 'Solo se aprueban becas por estas razones.'

export function esRazonDeBeca(v: unknown): v is RazonDeBeca {
  return typeof v === 'string' && (RAZONES_DE_BECA as readonly string[]).includes(v)
}

/**
 * El texto que amplía la situación es OBLIGATORIO, con razón elegida o sin
 * ella. La categoría dice el QUÉ y sirve para contar; el texto dice el caso,
 * que es lo que Meli lee para decidir. Sin él, tres personas con «desempleo»
 * son indistinguibles.
 */
export const MINIMO_DEL_DETALLE = 20

// ── 2 · El monto ────────────────────────────────────────────────────────────

/**
 * La nota del monto está redactada para que la gente pida MENOS, no más.
 *
 * Decir «las becas son del 50%» antes de preguntar fija el techo: quien
 * necesita menos lo dice, y quien necesita el 50% no tiene que pedirlo. Al
 * revés —un campo vacío con «¿cuánto necesitás?»— invita a pedir el máximo.
 */
export const PORCENTAJE_DE_BECA = 50
export const NOTA_DE_MONTO =
  `Las becas de Theos son del ${PORCENTAJE_DE_BECA}%. Si necesitás un monto menor, indicalo aquí.`

/** El monto es opcional. Cero o negativo no es un monto: se guarda `null`. */
export function montoPedido(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── 4 · El cupo ─────────────────────────────────────────────────────────────

/**
 * El aviso del cupo, en el formulario Y en el correo de confirmación.
 *
 * Es la regla operativa de Meli: aprueba la última semana de matrícula para
 * priorizar a quien paga. Sin decirlo, la persona manda la solicitud y da el
 * campo por asegurado — y cuando no sale, la decepción es con Theos y no con
 * un cupo que nunca existió.
 */
export const AVISO_DE_CUPO =
  'Las becas se analizan la última semana de matrícula y dependen del cupo disponible. '
  + 'No des por asegurado el campo.'

// ── 5 · Cuando el grupo se llena ────────────────────────────────────────────

/**
 * Estados de una solicitud. `por_modificar` es el nuevo.
 *
 * Cuando el grupo elegido se llena, la solicitud NO se rechaza: rechazarla
 * obligaría a la persona a empezar de cero y a Meli a leer el caso otra vez.
 * Pasa a `por_modificar`, que significa «sigue viva, falta que elijas otro
 * grupo».
 */
export const ESTADOS_DE_SOLICITUD = [
  'open', 'in_review', 'por_modificar', 'resolved', 'rejected',
] as const
export type EstadoDeSolicitud = (typeof ESTADOS_DE_SOLICITUD)[number]

/** ¿Sigue viva? Lo que no está resuelto ni rechazado espera algo de alguien. */
export function sigueAbierta(estado: string): boolean {
  return estado === 'open' || estado === 'in_review' || estado === 'por_modificar'
}

/** ¿Es la persona quien tiene que mover ficha? Solo en `por_modificar`. */
export function esperaAlSolicitante(estado: string): boolean {
  return estado === 'por_modificar'
}

export const AVISO_GRUPO_LLENO =
  'El grupo que elegiste se llenó. Entrá y elegí otro para mantener tu solicitud.'

// ── 6 · Convertir en arreglo de pago ────────────────────────────────────────

/**
 * Ofrecer un arreglo NO es rechazar.
 *
 * La diferencia importa para quien recibe el aviso: «no te damos la beca» y
 * «no hay beca pero podés pagarlo en partes» son dos mensajes muy distintos,
 * y el segundo deja a la persona adentro. Por eso la solicitud queda
 * `resolved` con la nota de que se ofreció el arreglo, no `rejected`.
 */
export const NOTA_DE_CONVERSION =
  'Se ofreció un arreglo de pago en lugar de la beca.'

/**
 * ¿Se puede ofrecer un arreglo sobre esta solicitud?
 *
 * Hace falta un cobro al cual aplicarlo. Sin `payment_id` no hay nada que
 * partir en tractos, y ofrecerlo igual daría un botón que falla al tocarlo.
 */
export function puedeOfrecerArreglo(solicitud: {
  status: string
  payment_id: string | null
}): { ok: true } | { ok: false; motivo: string } {
  if (!sigueAbierta(solicitud.status)) {
    return { ok: false, motivo: 'Esta solicitud ya está cerrada.' }
  }
  if (!solicitud.payment_id) {
    return {
      ok: false,
      motivo: 'No hay un cobro al cual aplicarle el arreglo. Registrá primero la matrícula '
        + 'o la inscripción.',
    }
  }
  return { ok: true }
}

/**
 * El aviso que recibe quien pidió la beca cuando su grupo se llena.
 *
 * Dice QUÉ HACER y no solo qué pasó: «se llenó» a secas deja a la persona
 * sin saber si perdió la beca o tiene que volver a pedirla. Lo que necesita
 * oír es que la solicitud sigue viva.
 */
export const TITULO_GRUPO_LLENO = 'El grupo que elegiste se llenó'

export function cuerpoDeGrupoLleno(input: {
  grupo: string
  estudio: string | null
}): string {
  // El «de <estudio>» se arma con el espacio adentro, no alrededor: con la
  // plantilla al revés, un estudio nulo dejaba dos espacios seguidos.
  const que = input.estudio ? ` de ${input.estudio}` : ''
  return `El grupo${que} que elegiste (${input.grupo}) ya no tiene campo. `
    + 'Tu solicitud de beca SIGUE EN PIE: entrá y elegí otro grupo para mantenerla. '
    + 'No tenés que pedirla de nuevo.'
}

/** Tipo de notificación interna, para poder filtrarlas después. */
export const TIPO_GRUPO_LLENO = 'beca_grupo_lleno'

/**
 * El aviso de que se le ofreció un arreglo en vez de la beca.
 *
 * Dice el NÚMERO de tractos. «Se te ofreció un arreglo» sin cifra obliga a
 * entrar a ver de qué se trata, y quien está esperando respuesta a una beca
 * merece saber en el aviso si el ofrecimiento le sirve.
 */
export const TIPO_ARREGLO_OFRECIDO = 'beca_convertida_en_arreglo'
export const TITULO_ARREGLO_OFRECIDO = 'Te ofrecimos un arreglo de pago'

export function cuerpoDeArregloOfrecido(tractos: number): string {
  return `Tu solicitud de beca se resolvió con un arreglo de pago: el cobro quedó partido `
    + `en ${tractos} tractos. Entrá a Mis pagos para ver las fechas y los montos.`
}
