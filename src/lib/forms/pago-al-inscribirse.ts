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
