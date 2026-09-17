/**
 * EVE-12 · Hasta dónde llega el rol de eventos de una persona.
 *
 * EL PROBLEMA. `encargado_eventos` abría TODOS los eventos, y hoy 184 de los
 * 193 que lo tienen no se lo dio nadie: se los puso `position-role-sync` por
 * ocupar un puesto de logística, bienvenida o información en el comité de SU
 * sede. Quien hace el check-in del miércoles en Alajuela podía editar el
 * campamento, borrar asistencias de Liberia y cobrar en la puerta de Cartago.
 *
 * LA REGLA. El rol puesto A MANO no cambia: sigue abriendo todo. El rol que
 * llegó por el puesto queda acotado a los eventos donde alguno de SUS comités
 * es organizador. Por eso primero hubo que etiquetar las 170 charlas que no
 * decían de quién eran (ver comite-de-la-charla.ts): sin ese dato la regla le
 * quitaba a las 184 personas justamente el check-in que hacen cada semana.
 *
 * Medido antes de encenderla (2026-09-17, últimos 90 días): nadie se queda en
 * cero. Cada quien alcanza entre 9 y 42 eventos, que son los de su sede. Un
 * solo evento quedó sin comité —el taller "Entre Mujeres"— y ese lo operan
 * únicamente los roles manuales hasta que se le asigne uno.
 *
 * Módulo PURO: el caller resuelve los datos y esta función decide. Mismo molde
 * que groupViewerScope y eventViewerScope.
 */
import { hasEventsModule, isEventAdmin } from './events-scope'
import type { RoleId } from '@/types/auth'

export type AlcanceDeEventos =
  /** Ve y opera todos los eventos. */
  | { alcance: 'todos' }
  /** Solo los eventos organizados por estos comités. */
  | { alcance: 'comites'; comites: readonly string[] }
  /** El módulo de eventos no lo abre; queda el camino de encargado del evento. */
  | { alcance: 'ninguno' }

export function alcanceDeEventos(input: {
  roles: readonly RoleId[] | null | undefined
  /** Los roles activos cuyo `member_roles.origen` es 'automatico'. */
  rolesAutomaticos: readonly RoleId[] | null | undefined
  /** Ids de los comités donde tiene un puesto ACTIVO. */
  comitesDeSusPuestos: readonly string[] | null | undefined
}): AlcanceDeEventos {
  const roles = input.roles ?? []
  // Dirección, staff, comunicaciones y admin administran eventos y nunca los
  // otorga un puesto: no hay nada que acotar.
  if (isEventAdmin(roles)) return { alcance: 'todos' }
  if (!hasEventsModule(roles)) return { alcance: 'ninguno' }

  // ¿Algún rol que abre el módulo se lo dieron a mano? Entonces manda ese.
  // Se pregunta rol por rol y no "¿tiene alguno automático?": alguien puede
  // tener el rol por su puesto Y además otro rol de eventos puesto a mano, y en
  // ese caso lo manual no se le recorta.
  const automaticos = new Set(input.rolesAutomaticos ?? [])
  const porLaVíaManual = roles.some(r => !automaticos.has(r) && hasEventsModule([r]))
  if (porLaVíaManual) return { alcance: 'todos' }

  return { alcance: 'comites', comites: [...new Set(input.comitesDeSusPuestos ?? [])] }
}

/**
 * ¿Puede operar ESTE evento (editar, check-in, inscripciones, cobro)?
 *
 * Un evento SIN comité organizador le queda cerrado a quien tiene alcance por
 * comité. Es a propósito: sin esa etiqueta no hay forma de saber si es suyo, y
 * negar se arregla asignándole comité al evento, mientras que permitir abre
 * todos los eventos sueltos a todo el mundo.
 */
export function puedeOperarEvento(
  alcance: AlcanceDeEventos, comitesDelEvento: readonly string[],
): boolean {
  if (alcance.alcance === 'todos') return true
  if (alcance.alcance === 'ninguno') return false
  return comitesDelEvento.some(c => alcance.comites.includes(c))
}

/** Mensaje del 403 cuando el evento existe pero no es de su comité. */
export const NO_ES_DE_TU_COMITE =
  'Este evento no es de tu comité. Solo podés gestionar los eventos que organiza tu sede o comité.'
