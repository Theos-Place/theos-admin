/**
 * FAM-3 · Autorización para aparecer en fotos y publicaciones.
 *
 * TRES ESTADOS, NO DOS, y esa es toda la regla:
 *
 *   pendiente  (NULL)  · no se le preguntó a nadie
 *   si         (true)  · dijo que sí
 *   no         (false) · dijo que NO
 *
 * "No me preguntaron" y "me preguntaron y dije que no" no son lo mismo. Con un
 * booleano de dos estados se pierde la diferencia para siempre: nadie podría
 * saber a quién falta consultar, y se estaría afirmando una negativa que nadie
 * dio.
 *
 * Donde de verdad importa es en los MENORES: publicar la foto de un menor sin
 * autorización de su familia es justo lo que este campo viene a evitar, y
 * "pendiente" es la señal de que hay que ir a preguntar. Por eso `puedePublicarse`
 * trata pendiente como NO — ante la duda, no se publica.
 */
export type EstadoDeAutorizacion = 'pendiente' | 'si' | 'no'

export function estadoDeAutorizacion(valor: boolean | null | undefined): EstadoDeAutorizacion {
  if (valor === true) return 'si'
  if (valor === false) return 'no'
  return 'pendiente'
}

/** Lo contrario: de lo que elige la pantalla al valor que va a la base. */
export function aValorGuardado(estado: EstadoDeAutorizacion): boolean | null {
  return estado === 'si' ? true : estado === 'no' ? false : null
}

export const ETIQUETA: Record<EstadoDeAutorizacion, string> = {
  pendiente: 'Pendiente de preguntar',
  si: 'Autorizado',
  no: 'No autorizado',
}

/** El texto que ve quien marca la casilla. Dice DÓNDE puede aparecer, porque
 *  "autorizo fotos" a secas no es un consentimiento informado. */
export const TEXTO_DE_LA_CASILLA =
  'Autorizado para aparecer en fotos del grupo, redes sociales y publicaciones'

/**
 * ¿Se puede publicar su imagen?
 *
 * Pendiente cuenta como NO. Es lo contrario de lo cómodo y es lo correcto:
 * quien consulta esto está por publicar una foto, y la ausencia de respuesta no
 * es un permiso.
 */
export function puedePublicarse(valor: boolean | null | undefined): boolean {
  return valor === true
}

/**
 * ¿Hay que salir a preguntarle? Solo si está pendiente.
 *
 * `esMenor` se recibe ya calculado —lo resuelve `lib/members/reglas-de-menores`,
 * que es la única fuente de esa regla— para no tener dos definiciones de quién
 * es menor dando vueltas.
 */
export function urgeConsultar(
  valor: boolean | null | undefined, esMenor: boolean,
): boolean {
  return estadoDeAutorizacion(valor) === 'pendiente' && esMenor
}
