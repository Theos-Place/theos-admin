/**
 * LINT-1 · La regla pura detrás de `usePrecarga`.
 *
 * EL PATRÓN QUE RESUELVE. Una pantalla de editar carga datos y los vuelca a
 * los `useState` del formulario. Hacerlo en un `useEffect` es lo que marca
 * `react-hooks/set-state-in-effect`, y el aviso tiene razón: el efecto corre
 * DESPUÉS de pintar, así que el formulario aparece un instante vacío y
 * después salta a los valores. Con una conexión lenta se ve.
 *
 * La forma correcta es ajustar el estado DURANTE el render comparando contra
 * la clave del dato que ya se volcó — es lo que React documenta como
 * «adjusting state when props change»: el re-render ocurre antes de pintar,
 * no hay parpadeo, y no hay efecto que apagar.
 *
 * Acá vive solo la DECISIÓN, que es lo que se puede probar sin React.
 *
 * Módulo PURO.
 */

/**
 * ¿Hay que volcar los datos ahora?
 *
 * `clave` identifica al dato cargado (normalmente su id). `yaVolcado` es la
 * clave de lo que se volcó la última vez.
 *
 * Sin clave no se vuelca: todavía no llegó nada. Y con la misma clave
 * tampoco, que es lo que impide pisar lo que la persona está escribiendo en
 * cada render.
 */
export function hayQueVolcar(
  clave: string | null | undefined,
  yaVolcado: string | null,
): boolean {
  if (clave == null || clave === '') return false
  return clave !== yaVolcado
}
