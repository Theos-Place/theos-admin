/**
 * Con qué estado de pago NACE una inscripción creada al llenar el formulario.
 *
 * EL CASO (Floriana, 2026-10-07): «el default del pago debe ser aceptado».
 * Y tiene razón PARA SU CASO: el formulario del 10 de octubre pide el
 * comprobante de pago como campo OBLIGATORIO, así que todo el que logró
 * enviarlo ya pagó. Dejarlos a todos en «pendiente» obliga a revisar 80
 * inscripciones a mano para marcar lo que el formulario ya probó.
 *
 * PERO «aceptado» A SECAS SERÍA FALSO. El mismo camino crea inscripciones de
 * actividades gratuitas, de actividades que se pagan en la puerta y de
 * formularios que no piden nada. Ahí un `paid` por default diría que pagó
 * quien no pagó, y eso no se nota hasta que alguien cuadra la plata.
 *
 * LA REGLA, que es la de ella sin la parte peligrosa:
 *
 *   El formulario PIDE comprobante de pago  Y  la persona lo ADJUNTÓ
 *   →  la inscripción nace `paid`.
 *   En cualquier otro caso  →  `pending`, como siempre.
 *
 * No hace falta configurar nada por actividad: el formulario ya dice si hay
 * que pagar, porque le pide a la gente que lo pruebe. Y no le regala la
 * entrada a nadie — hay un comprobante adjunto en la respuesta.
 *
 * QUÉ NO HACE: no revisa que el comprobante sea válido ni que el monto
 * cuadre. Eso lo sigue haciendo finanzas, que puede devolver la inscripción
 * a `pending` cuando el comprobante no sirve. Esto cambia el punto de
 * partida, no el control.
 */

/** Lo que el CHECK de `event_registrations.payment_status` acepta. */
export type EstadoDePago = 'pending' | 'paid' | 'exempted' | 'expired'

export type CampoDelFormulario = {
  id: string
  field_type: string
  label: string | null
  is_required?: boolean | null
}

/**
 * ¿Este campo es el comprobante de pago?
 *
 * Se mira el TIPO y la ETIQUETA: tiene que ser un adjunto (`image` o `file`)
 * y nombrar un comprobante. Solo por tipo, la foto del carnet o la del
 * permiso del menor contarían como pago; solo por etiqueta, un campo de
 * texto que dijera «comprobante» también.
 */
export function esCampoDeComprobante(campo: CampoDelFormulario): boolean {
  if (campo.field_type !== 'image' && campo.field_type !== 'file') return false
  const l = (campo.label ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
  return /comprobante|recibo|transferencia|sinpe|deposito|pago/.test(l)
}

/** ¿El formulario exige probar el pago? Pide que el campo sea OBLIGATORIO:
 *  si es opcional, quien no lo sube no pagó y no puede nacer `paid`. */
export function pideComprobante(campos: ReadonlyArray<CampoDelFormulario>): boolean {
  return campos.some(c => esCampoDeComprobante(c) && !!c.is_required)
}

/** Una respuesta tiene el comprobante si el campo trae algo que no está vacío. */
export function adjuntoComprobante(
  campos: ReadonlyArray<CampoDelFormulario>,
  respuestas: ReadonlyArray<{ field_id: string; value_text?: string | null; value_json?: unknown }>,
): boolean {
  const ids = new Set(campos.filter(esCampoDeComprobante).map(c => c.id))
  return respuestas.some(r => {
    if (!ids.has(r.field_id)) return false
    if (typeof r.value_text === 'string' && r.value_text.trim() !== '') return true
    const j = r.value_json
    if (Array.isArray(j)) return j.length > 0
    if (typeof j === 'string') return j.trim() !== ''
    return j !== null && j !== undefined
  })
}

export function estadoDePagoAlInscribirse(input: {
  campos: ReadonlyArray<CampoDelFormulario>
  respuestas: ReadonlyArray<{ field_id: string; value_text?: string | null; value_json?: unknown }>
}): EstadoDePago {
  return pideComprobante(input.campos) && adjuntoComprobante(input.campos, input.respuestas)
    ? 'paid'
    : 'pending'
}

// ── El PAGO, que es la otra mitad y faltaba ────────────────────────────────
/**
 * Marcar la inscripción como pagada no alcanza. Son DOS tablas:
 * `event_registrations.payment_status` es lo que ve el tab del evento, y
 * `payments` es lo que ve finanzas y lo que sale en el perfil de cada
 * persona. El 2026-10-07 el evento del 10 de octubre mostraba «pagado» en el
 * tab y «pendiente» en los dos otros lados, porque el camino automático
 * nunca creó la fila de `payments` — y diez personas no tenían ninguna.
 *
 * APROBADO POR DEFAULT, que es lo que pidió Floriana. El comprobante viene
 * adjunto y el formulario lo exigía: dejarlo `en_revision` obliga a aprobar
 * a mano ochenta veces algo que el formulario ya probó. Finanzas puede
 * rechazarlo después — eso no se le quita a nadie.
 */
export type PagoDeInscripcion = {
  amount: number
  status: 'paid'
  review_status: 'aprobado'
  /** La fecha que la persona declaró en el formulario, si la puso. */
  payment_date: string | null
}

/** El campo donde la persona declara CUÁNDO pagó. Es texto/fecha, no prueba
 *  nada por sí solo — sirve para fechar el pago, no para aprobarlo. */
export function esCampoDeFechaDePago(campo: CampoDelFormulario): boolean {
  if (campo.field_type !== 'date') return false
  const l = (campo.label ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return /pago|pagu|deposit|transferenc|sinpe/.test(l)
}

/** Un `YYYY-MM-DD` o null. Cualquier otra cosa se descarta en vez de meterse
 *  a la base: una fecha rara acá desordena los reportes de finanzas. */
export function fechaDePagoDeclarada(
  campos: ReadonlyArray<CampoDelFormulario>,
  respuestas: ReadonlyArray<{ field_id: string; value_text?: string | null }>,
): string | null {
  const ids = new Set(campos.filter(esCampoDeFechaDePago).map(c => c.id))
  for (const r of respuestas) {
    if (!ids.has(r.field_id)) continue
    const v = (r.value_text ?? '').trim()
    if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)) return v
  }
  return null
}

/**
 * El pago que hay que crear junto con la inscripción, o null si no va ninguno.
 *
 * Va null cuando la inscripción no nace pagada (actividad gratuita, sin
 * comprobante) o cuando el evento no cobra nada. Un pago de ₡0 no es un pago:
 * ensucia el estado de cuenta de la persona con una línea que no significa
 * nada.
 */
export function pagoDeInscripcion(input: {
  campos: ReadonlyArray<CampoDelFormulario>
  respuestas: ReadonlyArray<{ field_id: string; value_text?: string | null; value_json?: unknown }>
  evento: { requires_payment?: boolean | null; payment_amount?: number | string | null }
}): PagoDeInscripcion | null {
  if (estadoDePagoAlInscribirse(input) !== 'paid') return null
  if (!input.evento.requires_payment) return null
  const monto = Number(input.evento.payment_amount ?? 0)
  if (!Number.isFinite(monto) || monto <= 0) return null
  return {
    amount: monto,
    status: 'paid',
    review_status: 'aprobado',
    payment_date: fechaDePagoDeclarada(input.campos, input.respuestas),
  }
}
