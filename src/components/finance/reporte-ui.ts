/**
 * Las clases de los reportes de finanzas, en UN lugar (2026-10-14).
 *
 * Floriana: «aún veo discrepancias de UI en los reportes, tamaños, espaciados,
 * márgenes distintos, además de colores diferentes». Las tres pestañas
 * (Donaciones, Pagos por entidad, Transparencia) se escribieron en momentos
 * distintos y cada una traía su propio padding de celda, su gris (tres
 * rgba distintos), su alto de input y sus filas cebra. Acá vive la versión
 * única; `reporte-ui.test.ts` falla si alguna pestaña vuelve a escribir una a
 * mano.
 */

/** Separación vertical entre bloques de una pestaña. */
export const PESTANA = 'space-y-5'

// ── Barra de herramientas ────────────────────────────────────────────────
/** Dos grupos: filtros a la izquierda (bajan de línea por dentro) y acciones
 *  arriba a la derecha. */
export const BARRA = 'flex items-start justify-between gap-2'
export const BARRA_IZQ = 'flex flex-1 min-w-0 flex-wrap items-center gap-1.5'
export const BARRA_DER = 'flex shrink-0 flex-wrap items-center justify-end gap-1.5'
export const ETIQUETA_FILTRO = 'text-[13px] text-navy-light/80 font-body'
/** Etiqueta + campo («Desde [fecha]»). */
export const GRUPO_FILTRO = 'flex items-center gap-1'
/** Inputs de fecha, selects y buscador: mismo alto, mismo texto. */
export const CAMPO = 'rounded-xl border border-[var(--outline-variant)] bg-surface-card px-2.5 py-2 text-[13px] text-navy outline-none font-body focus:ring-1 focus:ring-coral/30'
/** Las fechas a un ancho fijo: el input de fecha trae un ancho propio que
 *  cambia según el navegador, y con el suyo la barra no cabía en una línea a
 *  1440 px. 130 px entra «28/12/2026» con el ícono del calendario. */
export const CAMPO_FECHA = `${CAMPO} w-[130px]`

const BOTON = 'inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-medium transition-colors shrink-0 font-body disabled:opacity-50'
export const BOTON_SECUNDARIO = `${BOTON} border border-navy/20 text-navy hover:bg-navy/5`
export const BOTON_PRIMARIO = `${BOTON} bg-navy text-white hover:bg-navy/90`
export const BOTON_ACENTO = `${BOTON} bg-coral text-white hover:bg-coral-deep`

// ── Tarjetas de totales ──────────────────────────────────────────────────
export const TARJETAS = 'grid grid-cols-1 sm:grid-cols-3 gap-4'
export const TARJETA = 'rounded-2xl p-5 bg-surface-card shadow-[var(--shadow-md)]'
export const TARJETA_ETIQUETA = 'flex items-center gap-1.5 text-[11px] uppercase tracking-widest mb-2 font-display text-navy-light/80'
/** El número grande. El color va aparte (VALOR_*), siempre con tokens. */
export const TARJETA_VALOR = 'text-3xl font-extrabold font-display'
export const VALOR_NEUTRO = 'text-navy'
export const VALOR_DINERO = 'text-teal-deep'
export const VALOR_PENDIENTE = 'text-[#A8821F]'

// ── Tablas ───────────────────────────────────────────────────────────────
export const CAJA_TABLA = 'rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]'
export const TH = 'px-5 py-3.5 text-left text-[11px] uppercase tracking-widest font-display text-navy-light/80 whitespace-nowrap'
export const TD = 'px-5 py-3.5'
/** Fila sin cebra: el hover ya marca dónde está el ojo. */
export const FILA = 'border-b border-[var(--outline-variant)] hover:bg-surface-low transition-colors'
export const CELDA_FUERTE = 'text-[13px] font-medium font-body text-navy'
export const CELDA = 'text-[13px] font-body text-navy-light/80'
export const CARGAR_MAS = 'rounded-full border border-[var(--outline-variant)] px-5 py-2 text-[13px] text-navy hover:bg-surface-low transition-colors font-body disabled:opacity-50'
