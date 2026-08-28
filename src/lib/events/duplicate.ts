// Qué se copia y qué NO al duplicar un evento (módulo puro).
//
// La consulta vive en la ruta; acá está la decisión, que es lo que conviene
// poder discutir y testear.

import type { EventWriteInput } from '@/lib/supabase/queries/events'

/** Sufijo del título de la copia. */
export const SUFIJO_COPIA = ' (copia)'

type Origen = Partial<EventWriteInput> & {
  title: string
  event_type: string
  starts_at: string
}

/**
 * El evento nuevo a partir del original.
 *
 * SE COPIA todo lo que define al evento: horario, lugar, cupo, precios, flyer,
 * recurrencia, encuesta y el formulario de inscripción. Es lo que hace que
 * duplicar sirva — si hubiera que reconfigurar la mitad, es más rápido crearlo
 * de cero.
 *
 * NO SE COPIA:
 *
 *  · `is_public` — la copia entra INTERNA aunque el original fuera público. Su
 *    fecha todavía es la del original, y publicarla de una la mete en el
 *    calendario compitiendo con el evento real. Se publica cuando esté lista.
 *
 *  · el estado del envío de la encuesta (survey_send_at, survey_sent_at) — es
 *    el rastro de lo que YA pasó con el evento original. Copiarlo haría que la
 *    copia crea que ya mandó una encuesta que nunca mandó.
 *
 *  · `status` — la copia arranca en 'upcoming' aunque el original esté
 *    terminado o cancelado. Duplicar un evento pasado es la razón más común
 *    para duplicar: se repite el del año anterior.
 *
 *  · `parent_event_id` — la copia es un evento nuevo, no una ocurrencia de la
 *    serie del original.
 *
 * Las inscripciones y las excepciones de recurrencia no aparecen acá porque
 * viven en otras tablas: nada las arrastra.
 */
export function eventoDuplicado(origen: Origen): EventWriteInput {
  return {
    title: `${origen.title}${SUFIJO_COPIA}`,
    event_type: origen.event_type,
    starts_at: origen.starts_at,
    ends_at: origen.ends_at ?? null,
    description: origen.description ?? null,
    sede_id: origen.sede_id ?? null,
    location: origen.location ?? null,
    location_url: origen.location_url ?? null,
    is_virtual: origen.is_virtual ?? false,
    virtual_url: origen.virtual_url ?? null,
    max_capacity: origen.max_capacity ?? null,
    flyer_url: origen.flyer_url ?? null,
    is_recurring: origen.is_recurring ?? false,
    recurrence_rule: origen.recurrence_rule ?? null,
    recurrence_end: origen.recurrence_end ?? null,
    requires_registration: origen.requires_registration ?? false,
    requires_payment: origen.requires_payment ?? false,
    payment_amount: origen.payment_amount ?? null,
    currency: origen.currency ?? 'CRC',
    server_price: origen.server_price ?? null,
    servers_pay: origen.servers_pay ?? false,
    requires_survey: origen.requires_survey ?? false,
    registration_form_id: origen.registration_form_id ?? null,
    survey_form_id: origen.survey_form_id ?? null,
    survey_template_id: origen.survey_template_id ?? null,
    survey_offset_hours: origen.survey_offset_hours ?? null,
    // Ver arriba: los tres que NO se heredan.
    is_public: false,
    status: 'upcoming',
    survey_send_at: null,
  }
}
