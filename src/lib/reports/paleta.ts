/**
 * La paleta y las medidas de los gráficos de /reportes, en un solo lugar.
 *
 * Antes cada pantalla repetía sus propios hexes y varios quedaron demasiado
 * claros para leerse: el coral atenuado de las semanas daba 1,98:1 contra el
 * blanco y el turquesa de las series 2,15:1. WCAG pide 3:1 para un elemento
 * gráfico que transmite información (1.4.11), así que esas barras no se veían
 * — literalmente el reclamo de "cuesta leer los datos".
 *
 * Los ejes tampoco: Recharts pinta los ticks en #666 por defecto y en 11px.
 * Ahora van en navy-light y 12px, que es el mínimo del sistema para texto
 * informativo.
 *
 * Los ratios no se estiman: paleta.test.ts los calcula y falla si alguno baja.
 */

/** Fondo real de los gráficos: todos viven dentro de una ChartCard blanca. */
export const FONDO_GRAFICO = '#FFFFFF'

/** Serie principal / dato destacado. */
export const CORAL = '#D63E3D'
/** El mismo coral un paso más claro, para el resto de las barras de la serie.
 *  Sigue pasando 3:1 — antes era un rgba al 55% que no se veía. */
export const CORAL_ATENUADO = '#E06F6E'
/** Dato INCOMPLETO (la semana en curso). El relleno claro es la señal de
 *  "todavía no está cerrado", y el contraste lo carga el borde punteado: un
 *  relleno pálido solo nunca llega a 3:1 sin dejar de verse incompleto. */
export const PARCIAL_RELLENO = '#F4C3C2'
export const PARCIAL_BORDE = '#C43635'

export const NAVY = '#161440'
export const NAVY_CLARO = '#29365C'
export const TEAL = '#3B7579'
/** Turquesa un paso más claro, SOLO para las series por año: el teal de marca y
 *  el coral tienen casi la misma luminosidad (1,15:1 entre sí), así que juntos
 *  en un mismo gráfico se distinguen por tono y nada más — inservible para
 *  quien no separa rojo de verde. Este se aleja en claridad además de en tono. */
export const TEAL_CLARO = '#4E9CA2'
/** Categoría residual ("Sin sede", "Otros"): gris, pero legible. */
export const GRIS = '#7C7C96'

/** Series por año en los comparativos, del más viejo al más nuevo. El último es
 *  siempre el año seleccionado ⇒ coral, igual que en el resto de la pantalla.
 *  Los tres se distinguen por tono Y por claridad, no solo por color. */
export const COLORES_POR_ANIO = [TEAL_CLARO, NAVY, CORAL]

/** Ticks de los ejes. Recharts sin esto usa #666 a 11px. */
export const EJE_TICK = { fontSize: 12, fill: NAVY_CLARO, fontFamily: 'var(--font-body)' } as const

/** Rejilla: decorativa, pero la de 0,15 de opacidad era invisible. */
export const REJILLA = 'rgba(22, 20, 64, 0.22)'

/** Barra resaltada bajo el cursor. */
export const CURSOR_BARRA = { fill: 'rgba(22, 20, 64, 0.06)' } as const

export const ESTILO_TOOLTIP = {
  borderRadius: 12,
  border: '1px solid var(--outline-variant)',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  color: NAVY,
} as const

/** Números impresos al lado de la barra. Que el valor esté a la vista y no solo
 *  en el hover: en una tablet no hay hover, y comparar dos barras obliga a
 *  pasar por encima de cada una. */
export const ETIQUETA_VALOR = {
  fontSize: 12, fill: NAVY, fontFamily: 'var(--font-body)', fontWeight: 600,
} as const

/** Nombre de la categoría en un gráfico de barras horizontales. */
export const ETIQUETA_CATEGORIA = {
  fontSize: 12, fill: NAVY_CLARO, fontFamily: 'var(--font-body)',
} as const

/**
 * Ancho del eje de categorías en un gráfico de barras horizontales, para que
 * cada nombre entre EN UNA SOLA LÍNEA.
 *
 * Recharts parte la etiqueta en varias líneas cuando no le cabe, y con los
 * nombres de sede largos ("Pedregal Miércoles Youth") el eje quedaba en dos y
 * tres renglones pegados unos a otros. El ancho fijo de 110px era de cuando las
 * sedes se llamaban "Heredia".
 *
 * La medida es una estimación por número de caracteres —no hay forma de medir
 * texto sin el DOM y esto corre también en el servidor—, calibrada para Gilmer
 * a 12px. El tope evita que un nombre disparatado se coma el gráfico: ese sí se
 * parte, que es el mal menor.
 */
export function anchoDeEjeCategoria(etiquetas: string[], maximo = 190): number {
  const masLarga = etiquetas.reduce((n, e) => Math.max(n, e.length), 0)
  return Math.min(maximo, Math.max(90, Math.round(masLarga * 6.6) + 12))
}

/** Aire a la derecha para que el número impreso al final de la barra no quede
 *  cortado por el borde de la tarjeta. */
export function margenParaEtiquetas(valores: number[]): number {
  const masLargo = valores.reduce((n, v) => Math.max(n, v.toLocaleString('es-CR').length), 0)
  return Math.round(masLargo * 7.5) + 14
}
