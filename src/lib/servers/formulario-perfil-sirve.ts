/**
 * SRV-20 (etapa 2) · El formulario ESPEJO del perfil S.I.R.V.E.
 *
 * QUÉ ES. El mismo bloque que está en la pestaña «Espiritual y S.I.R.V.E.»
 * del perfil, envuelto en un formulario: reemplaza al formulario 128 de CCB
 * que llenaban los estudiantes de Sirviendo como Jesús después de la oración
 * de envío. Abre PRELLENADO con lo que la persona ya tiene y lo que corrige
 * entra al perfil campo por campo — no queda en respuestas que alguien
 * transcribe. Calcado de SRV-9 (`formulario-de-disponibilidad`).
 *
 * NO GUARDA RESPUESTAS PARA EL BLOQUE: el campo `sirve_profile` escribe en
 * `member_spiritual_data`. La pregunta extra sí es una respuesta normal.
 *
 * LA AUDIENCIA: quien completó O está cursando Sirviendo como Jesús (plan
 * SCJ). Desde el 2026-10-21 el dirigente manda la invitación a todo el grupo
 * mientras está en curso, así que «completó» solo dejaría afuera a quien
 * recibe el correo. Sin la restricción, cualquiera con el
 * link abre un formulario que le promete guardar un perfil que la
 * coordinación no esperaba. Se arma con el mismo sistema del padrón (FRM-5)
 * y se prueba contra `normalizeRestriction`: una restricción mal formada se
 * descarta en silencio y el formulario queda abierto a todo el mundo.
 *
 * Módulo PURO: define el contenido. Quien escribe en la base es el seed
 * (`scripts/srv20/sembrar-formulario-perfil-sirve.ts`).
 */
import type { CampoSembrado } from '@/lib/studies/formulario-de-disponibilidad'

export const TITULO_DEL_FORMULARIO = 'Tu perfil S.I.R.V.E.'

export const DESCRIPCION_DEL_FORMULARIO =
  'Terminaste Sirviendo como Jesús: contanos tus dones, tu estilo, tus habilidades y '
  + 'dónde te gustaría servir. Lo que ya tengamos guardado viene lleno; revisalo y '
  + 'corregí lo que cambió. Cada cambio se guarda solo.'

/** El plan cuya graduación abre el formulario. */
export const PLAN_QUE_ABRE = 'SCJ'

export type IdsDelFormulario = {
  intro: string
  perfil: string
  comentarios: string
}

export function camposDelFormulario(ids: IdsDelFormulario): CampoSembrado[] {
  return [
    {
      id: ids.intro,
      field_type: 'info',
      label: 'Antes de empezar',
      description:
        'No te pedimos tus datos personales, tu comité ni tu sede: eso ya lo tiene el '
        + 'sistema. Acá va lo que solo vos sabés de vos.',
    },
    {
      id: ids.perfil,
      field_type: 'sirve_profile',
      label: 'Tu perfil S.I.R.V.E.',
      // No es obligatorio, y no puede serlo: este campo no guarda respuesta,
      // así que exigirlo bloquearía el envío para siempre.
      is_required: false,
    },
    {
      id: ids.comentarios,
      field_type: 'textarea',
      label: '¿Algo más que debamos saber?',
      description: 'Opcional. Lo lee la coordinación de servidores.',
      is_required: false,
    },
  ]
}

/** Quien completó o está cursando SCJ (`status: 'any'` = completado + matrícula vigente). Mismo formato del padrón. */
export function restriccionGraduadosSCJ() {
  return {
    conditions: [{ id: 1, group: 'study', type: 'study', study: PLAN_QUE_ABRE, status: 'any', from: null, to: null }],
    groups: [],
    ops: {},
  }
}
