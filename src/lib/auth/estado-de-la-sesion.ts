/**
 * UX-5 · "Todavía no sé" no es lo mismo que "no hay".
 *
 * EL PROBLEMA (reportado 2026-09-17). Al entrar después del login, la pantalla
 * de matrícula mostraba "No hay un miembro asociado a tu cuenta" por un
 * instante y luego se corregía sola. Asusta: parece que la cuenta no existe,
 * justo en el momento en que la persona acaba de crearla.
 *
 * LA CAUSA. `AuthProvider` arranca en `{ user: null, loaded: false }` y resuelve
 * la sesión con un fetch a /api/auth/me. La pantalla preguntaba solo por el
 * miembro (`if (!memberId)`), y mientras el fetch viaja eso es `null` — el
 * mismo valor que tiene alguien que de verdad no tiene ficha. Dos situaciones
 * distintas con el mismo valor: por eso una se veía como la otra.
 *
 * LA REGLA. Tres estados, no dos. Mientras `loaded` sea false no se afirma
 * nada. Vive acá y no en cada pantalla porque el error es fácil de repetir: la
 * pregunta natural al escribir la pantalla es "¿hay miembro?", y esa pregunta
 * es la equivocada.
 */
export type EstadoDeLaSesion =
  /** El fetch de la sesión todavía no volvió. No se afirma nada. */
  | 'cargando'
  /** Ya volvió y la cuenta no tiene ficha de miembro. */
  | 'sin_ficha'
  /** Ya volvió y hay ficha. */
  | 'lista'

export function estadoDeLaSesion(input: {
  /** `loaded` de useAuth: ¿ya contestó /api/auth/me? */
  loaded: boolean
  memberId: string | null | undefined
}): EstadoDeLaSesion {
  if (!input.loaded) return 'cargando'
  return input.memberId ? 'lista' : 'sin_ficha'
}

/** Texto único para el caso real de "esta cuenta no tiene ficha". Dice qué
 *  hacer y no solo qué pasa: quien lo ve no puede arreglarlo por su cuenta. */
export const SIN_FICHA_ASOCIADA =
  'Tu cuenta todavía no está asociada a una ficha de miembro. Escribinos a ti@theosplace.org para que la vinculemos.'
