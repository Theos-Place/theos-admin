/**
 * SRV-9 · El formulario ESPEJO de la campaña de actualización.
 *
 * QUÉ ES. El mismo bloque de disponibilidad que está en el perfil, pero
 * envuelto en un formulario: así la campaña de marzo/julio/noviembre se arma
 * con el módulo de formularios —portada, audiencia, preguntas extra— y lo que
 * la gente contesta ENTRA AL SISTEMA en vez de quedar en respuestas que
 * alguien transcribe. Eso último es exactamente lo que pasa hoy con los
 * formularios de Linktree.
 *
 * NO GUARDA RESPUESTAS PARA LA PARTE DE DISPONIBILIDAD: el campo
 * `leader_availability` escribe directo en `study_leaders`, campo por campo,
 * igual que `personal_data` escribe en la ficha del miembro. Las preguntas
 * extra sí son respuestas normales.
 *
 * LA AUDIENCIA NO ES UN DETALLE. Sin la restricción, cualquiera con el link
 * abre un formulario que le promete guardar una disponibilidad que no tiene
 * dónde guardarse — el bloque no se le muestra y la persona queda contestando
 * al aire. Se restringe con el mismo sistema del padrón (FRM-5): «es
 * dirigente».
 *
 * Módulo PURO: define el contenido. Quien escribe en la base es el seed.
 */

export const TITULO_DEL_FORMULARIO = 'Actualizá tus datos de dirigente'

export const DESCRIPCION_DEL_FORMULARIO =
  'Nos ayuda a armar los grupos del cuatrimestre. Lo que ya tenemos guardado viene '
  + 'lleno: revisalo, corregí lo que cambió y confirmá al final. Toma menos de cinco minutos.'

export type CampoSembrado = {
  id: string
  field_type: string
  label: string
  description?: string | null
  is_required?: boolean
  options?: readonly string[] | null
  /** La columna `form_fields.conditions`, que el adapter convierte en
   *  `logic_rules`. La forma es la MISMA del seed de EST-15: una regla con su
   *  operador y sus condiciones adentro, no una lista plana. */
  conditions?: Array<{
    id: string
    action: 'show' | 'hide'
    condition_operator: 'AND' | 'OR'
    conditions: Array<{ id: string; field_id: string; operator: string; value: string }>
  }> | null
}

export type IdsDelFormulario = {
  intro: string
  disponibilidad: string
  quiereCapacitarse: string
  cualesEstudios: string
  comentarios: string
}

/** La respuesta que abre la pregunta de cuáles estudios. Se exporta porque la
 *  condición del campo siguiente la compara: escribirla dos veces sería la
 *  forma de que un día no coincidan. */
export const SI_QUIERE_CAPACITARSE = 'Sí'

export function camposDelFormulario(
  ids: IdsDelFormulario,
  /** Los ids de la regla y de sus condiciones. Entra como parámetro para que
   *  el test pueda fijarlos y comparar; el seed pasa `randomUUID`. */
  nuevoId: () => string = () => Math.random().toString(36).slice(2),
): CampoSembrado[] {
  return [
    {
      id: ids.intro,
      field_type: 'info',
      label: 'Antes de empezar',
      description:
        'Esto NO cambia los estudios para los que estás capacitado — eso lo lleva la '
        + 'coordinación. Acá nos decís qué querés dar y cuándo podés.',
    },
    {
      id: ids.disponibilidad,
      field_type: 'leader_availability',
      label: 'Tu disponibilidad como dirigente',
      // No es obligatorio, y no puede serlo: este campo no guarda respuesta,
      // así que exigirlo bloquearía el envío para siempre.
      is_required: false,
    },
    {
      id: ids.quiereCapacitarse,
      field_type: 'yes_no',
      label: '¿Querés capacitarte para dar algún estudio nuevo?',
      description:
        'Esto es para invitarte a la próxima capacitación. No te asigna ningún grupo.',
      is_required: true,
    },
    {
      id: ids.cualesEstudios,
      field_type: 'text',
      label: '¿Cuáles te interesan?',
      description:
        'También podés marcarlos arriba, en «¿Qué te gustaría aprender a dar?». Si te '
        + 'interesa algo que no está en la lista, escribilo acá.',
      is_required: false,
      conditions: [{
        id: nuevoId(),
        action: 'show',
        condition_operator: 'AND',
        conditions: [{
          id: nuevoId(),
          field_id: ids.quiereCapacitarse,
          operator: 'eq',
          value: SI_QUIERE_CAPACITARSE,
        }],
      }],
    },
    {
      id: ids.comentarios,
      field_type: 'textarea',
      label: '¿Algo más que debamos saber?',
      description: 'Opcional. Lo lee la coordinación de dirigentes.',
      is_required: false,
    },
  ]
}

/**
 * La restricción de audiencia: SOLO dirigentes.
 *
 * Es el mismo formato del filtro del padrón (`Restriccion` de
 * `lib/audiencia/restriccion`), con la condición `leader` que PAR-7 dejó
 * disponible como audiencia. Se arma acá y no a mano en el seed para poder
 * probarla contra `normalizeRestriction`: una restricción mal formada se
 * descarta en silencio y el formulario queda abierto a todo el mundo, que es
 * el peor final posible para esto.
 */
export function restriccionSoloDirigentes() {
  return {
    conditions: [{ id: 1, group: 'leader', type: 'leader', value: 'yes' }],
    groups: [],
    ops: {},
  }
}
