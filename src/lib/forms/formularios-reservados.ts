import type { RoleId } from '@/lib/auth/roles'
import { EVALUATION_ROLES } from '@/lib/auth/roles'
import { SURVEY_FORM_TITLE } from '@/lib/studies/study-survey'

/**
 * RET-1 · Formularios cuyas RESPUESTAS no las abre el módulo de formularios.
 *
 * EL PROBLEMA QUE RESUELVE. La encuesta de satisfacción del estudio es un
 * formulario común y corriente, así que sus respuestas se leían desde
 * `/formularios/<id>/respuestas` como las de cualquier otro: bastaba con tener
 * el módulo `formularios`. Sumado al endpoint del grupo —que estaba abierto a
 * todo `STUDY_ADMIN_ROLES`—, eran 25 personas las que podían leer lo que un
 * estudiante escribió sobre su dirigente. Medido el 2026-09-25, contando las
 * dos vías.
 *
 * Cerrar solo el endpoint del grupo habría dejado la puerta de al lado abierta,
 * y es la que menos se mira porque no parece parte de estudios.
 *
 * SE IDENTIFICA POR TÍTULO y no por id: el formulario se crea con un seed y su
 * uuid cambia entre ambientes, así que un id fijo acá funcionaría en producción
 * y fallaría en silencio en staging — que es la peor forma de fallar para una
 * regla de acceso. El título ya es la clave que usa el resto del código para
 * encontrarlo (`currentSurveyFormId`).
 *
 * Módulo PURO.
 */
export type FormularioReservado = {
  titulo: string
  /** Quién SÍ puede leer sus respuestas. Lo demás no importa: ni el módulo de
   *  formularios ni un acceso puntual alcanzan. */
  roles: readonly RoleId[]
  /** Para el mensaje de error: por qué está cerrado. */
  motivo: string
}

export const FORMULARIOS_RESERVADOS: readonly FormularioReservado[] = [
  {
    titulo: SURVEY_FORM_TITLE,
    roles: EVALUATION_ROLES,
    motivo: 'Las respuestas de la encuesta de satisfacción solo las ve quien revisa evaluaciones.',
  },
]

/** La reserva de un formulario, o `null` si es uno común. */
export function reservaDelFormulario(titulo: string | null | undefined): FormularioReservado | null {
  if (!titulo) return null
  return FORMULARIOS_RESERVADOS.find(f => f.titulo === titulo) ?? null
}

/**
 * ¿Esta sesión puede leer las respuestas de este formulario?
 *
 * Devuelve `null` cuando el formulario no está reservado —ahí decide la regla
 * de siempre, `formViewerScope`— y el motivo del rechazo cuando lo está y la
 * sesión no alcanza. Un formulario reservado NO se abre con un acceso puntual
 * (`form_access_grants`): el grant sirve para invitar a alguien a un formulario
 * concreto, y acá lo que se protege es el contenido, no el formulario.
 */
export function bloqueoPorReserva(
  titulo: string | null | undefined,
  roles: readonly string[] | null | undefined,
): string | null {
  const reserva = reservaDelFormulario(titulo)
  if (!reserva) return null
  const puede = (roles ?? []).some(r => (reserva.roles as readonly string[]).includes(r))
  return puede ? null : reserva.motivo
}
