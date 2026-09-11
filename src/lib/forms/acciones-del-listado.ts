/**
 * Qué ofrece el listado de formularios según con qué permiso llegó la persona.
 *
 * El bug que lo motiva (2026-09-11, caso Carolina Salas): a alguien se le
 * comparten 10 formularios con un acceso puntual (form_access_grants). Ve el
 * listado —eso funcionaba—, pero hacer click en un formulario llevaba a una
 * pantalla que su permiso no alcanzaba y respondía "ACCESO RESTRINGIDO". Desde
 * afuera parece que no puede ver a la gente inscrita.
 *
 * El permiso se amplió (decisión del usuario, mismo día): un formulario
 * compartido se edita igual que uno propio. Lo que NO da un grant es el resto
 * del módulo — crear formularios nuevos, ni ver los que no le compartieron.
 */
import { hasFormsModule } from '@/lib/auth/forms-scope'
import { hasModulePermission } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

export type AccionesDelFormulario = {
  /** A dónde lleva hacer click en el formulario. */
  destino: string
  /** Botón "Editar", vista previa y el menú de acciones sobre ESE formulario. */
  muestraEditar: boolean
  /** Botón "Respuestas". */
  muestraRespuestas: boolean
  /** "Duplicar" crea un formulario NUEVO: es del módulo, no del acceso puntual. */
  muestraDuplicar: boolean
}

export function accionesDelFormulario(input: {
  roles: readonly RoleId[] | null | undefined
  formId: string
  grantedFormIds?: readonly string[] | null
}): AccionesDelFormulario {
  const roles = [...(input.roles ?? [])]
  const conModulo = hasFormsModule(roles)
  const conGrant = (input.grantedFormIds ?? []).includes(input.formId)
  const tieneAcceso = conModulo || conGrant
  // Con el módulo manda el permiso de edición (solo_lectura ve pero no toca);
  // con un acceso puntual, el formulario compartido se edita.
  const puedeEditar = conGrant || hasModulePermission(roles, 'formularios', 'edit')
  return {
    // El destino es lo MÁS que esa persona puede hacer con el formulario. Quien
    // no lo puede abrir va derecho a las respuestas, que es lo que sí alcanza.
    destino: tieneAcceso && (puedeEditar || conModulo)
      ? `/formularios/${input.formId}`
      : `/formularios/${input.formId}/respuestas`,
    muestraEditar: tieneAcceso && puedeEditar,
    muestraRespuestas: tieneAcceso,
    muestraDuplicar: hasModulePermission(roles, 'formularios', 'create'),
  }
}

/**
 * ¿Puede repartir el acceso a ESTE formulario?
 *
 * Decisión del usuario (2026-09-11): quien recibió un formulario compartido
 * también lo comparte — armar el equipo es parte de llevar la actividad. Espejo
 * del guard de /api/forms/[id]/access.
 *
 * (El encargado del EVENTO al que pertenece un formulario también puede, y el
 * API lo contempla; acá no se puede saber sin cargar el formulario, y hoy no hay
 * ni un formulario colgado de un evento. Cuando lo haya, se le pasa el evento.)
 */
export function puedeRepartirAcceso(input: {
  roles: readonly RoleId[] | null | undefined
  formId: string
  grantedFormIds?: readonly string[] | null
}): boolean {
  return (input.grantedFormIds ?? []).includes(input.formId)
    || hasModulePermission([...(input.roles ?? [])], 'formularios', 'edit')
}

/** ¿Se le ofrece crear formularios nuevos? Solo con el módulo: un acceso puntual
 *  es para llevar lo que le compartieron, y el botón terminaba en un muro. */
export function puedeCrearFormularios(roles: readonly RoleId[] | null | undefined): boolean {
  return hasModulePermission([...(roles ?? [])], 'formularios', 'create')
}
