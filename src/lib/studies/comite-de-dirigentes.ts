/**
 * Quién es un dirigente ACTIVO: el Comité Dirigentes es la fuente de verdad.
 *
 * EL BUG QUE ESTO ARREGLA (2026-09-17). El código buscaba el área con
 * `ilike('name', 'Comité de Dirigentes')` —coincidencia exacta, sin comodines—
 * y el comité se llama "Comité Dirigentes", sin el "de". Cero resultados.
 *
 * Eso rompía las dos puntas del diseño sin que nada avisara:
 *
 *  · `getActiveDirigentes()` devolvía [] siempre. La pantalla decide el estado
 *    con `activeMap.has(id) ? 'activo' : 'inactivo'`, así que TODOS los
 *    dirigentes aparecían inactivos.
 *  · `setDirigenteActive()` hacía `if (!area) return` justo antes de tocar el
 *    comité: activar o desactivar movía `study_leaders` y el rol, pero nunca el
 *    voluntariado. Las dos listas llevaban meses separándose.
 *
 * Al medirlo había tres números para la misma pregunta: 227 en el comité, 167
 * en `study_leaders.is_active` y 193 con el rol.
 *
 * POR DÓNDE SE ENTRA Y SE SALE. Solo hay dos puertas, y las dos sincronizan lo
 * mismo: la pantalla de dirigentes (`setDirigenteActive`/`addDirigente`) y la de
 * servidores (`assignVolunteer`/`removeVolunteer`, que detectan el comité y
 * llaman a la primera).
 *
 * A un dirigente NO se llega por vacante ni por aplicación: ese proceso no
 * existe para este comité (confirmado por el usuario el 2026-09-17, y medido:
 * cero vacantes y cero aplicaciones para cualquiera de sus puestos). Por eso
 * `syncRolesForApprovedApplications` no engancha nada de dirigentes. Si algún
 * día se abre ese camino, hay que engancharlo ahí también o las listas vuelven
 * a separarse en silencio.
 *
 * POR QUÉ EL NOMBRE VIVE ACÁ Y NO SUELTO EN LA QUERY. Estaba escrito a mano en
 * tres lugares distintos de `queries/studies.ts`, todos mal y todos fallando en
 * silencio. Con una sola constante, si alguien renombra el comité rompe un test
 * en vez de vaciar una pantalla.
 */

/** Nombre EXACTO del comité en `areas`. */
export const COMITE_DIRIGENTES = 'Comité Dirigentes'

/**
 * Puesto en el que se mete a un dirigente recién activado, cuando no tenía
 * ninguno. Antes se usaba `posIds[0]` —el primero que devolviera la consulta,
 * sin criterio—, y el comité tiene cinco puestos: podía terminar de "Encargado
 * Dirigentes" o de "Colaborador retroalimentación".
 */
export const PUESTO_POR_DEFECTO = 'Dirigente CR'

/**
 * ¿Este puesto del comité hace que la persona cuente como dirigente activo?
 *
 * Decisión del usuario (2026-09-17): cualquiera que empiece con "Dirigente".
 * Hoy eso es "Dirigente CR" (218), "Dirigente Madrid" (9) y "Dirigente" (7, un
 * puesto viejo con 169 inactivos). Quedan fuera "Encargado Dirigentes" y
 * "Colaborador retroalimentación", que son del comité pero no dan estudios.
 */
export function esPuestoDeDirigente(titulo: string | null | undefined): boolean {
  if (!titulo) return false
  return normalizar(titulo).startsWith('dirigente')
}

/** Sin tildes y en minúsculas: el puesto lo escribe una persona en un formulario. */
function normalizar(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
