/**
 * Quién puede abrir el FORMULARIO COMPLETO de una ficha.
 *
 * EL BUG QUE ESTO ARREGLA (UX-7, reportado el 2026-10-05). El botón «Editar»
 * del perfil se le mostraba a cualquiera, pero el endpoint solo deja a la
 * propia persona cambiar los campos de `CAMPOS_AUTOEDITABLES` y responde 403
 * —rechazando el guardado ENTERO— si el cuerpo trae cualquier otro. El
 * formulario los manda todos. Resultado: el miembro llenaba el formulario
 * completo y lo perdía al guardar.
 *
 * NO SE AMPLIARON PERMISOS (decisión de Floriana): lo que se alinea es la
 * VISIBILIDAD del botón con el permiso que ya existe. La regla de la casa es
 * que no haya ningún botón visible cuyo guardado vaya a fallar por permisos.
 *
 * La lista vive acá, en un módulo puro, y la usan la pantalla Y el endpoint.
 * Mientras estuvo escrita solo en el endpoint, la pantalla no tenía con qué
 * ponerse de acuerdo — y de eso se trataba el bug.
 *
 * El miembro sin estos roles NO queda sin nada: conserva la edición EN SITIO,
 * campo por campo, que respeta `CAMPOS_AUTOEDITABLES` y guarda de a un campo
 * (así un rechazo no se lleva el resto del trabajo).
 */

/** Los roles que pueden editar la ficha de otra persona. `admin` aparte. */
export const ROLES_QUE_EDITAN_FICHA = [
  'editor_perfiles', 'direccion', 'encargado_staff', 'coordinador_estudios',
] as const

/**
 * ¿Esta persona puede usar el formulario completo?
 *
 * Ojo con lo que NO entra: ser el dueño de la ficha. Editarse a uno mismo va
 * por la edición en sitio, no por el formulario, justo porque el formulario
 * manda campos que la autoedición rechaza.
 */
export function puedeEditarFichaCompleta(roles: readonly string[]): boolean {
  return roles.includes('admin')
    || ROLES_QUE_EDITAN_FICHA.some(r => roles.includes(r))
}
