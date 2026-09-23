/**
 * QA-1/N3 · Las clases de un botón, en un solo lugar.
 *
 * EL PROBLEMA MEDIDO (2026-09-22). No había componente de botón: cada pantalla
 * escribía las clases sueltas. Sobre 1.321 elementos clicables, 204 llevaban un
 * fondo de marca, y los 182 primarios estaban escritos de **86 formas
 * distintas**. Cambiar el estilo del botón primario era buscar y reemplazar en
 * cientos de sitios, y toda variante nueva nacía desalineada sin que nada
 * avisara.
 *
 * Las tres familias no se inventaron, se contaron en el código:
 *
 *   primario    182  coral con texto blanco
 *   secundario  ~121 borde fantasma sobre el fondo, texto navy-light
 *   navy         ~19 navy con texto blanco
 *
 * DOS COSAS QUE EL README DEL DESIGN SYSTEM DICE Y ACÁ NO SE SIGUEN, a
 * propósito:
 *
 * 1. «Hover → coral-soft (aclara, no oscurece)». Con texto blanco eso da
 *    **2.46:1**, menos de la mitad de lo que pide AA. El hover oscurece a
 *    coral-deep (5.35:1), que es lo que ya hacían 164 de los 182 botones.
 *    `accessibility.md` es del 2026-08-21 y manda sobre el README.
 * 2. «Primary buttons — pill. Always». En el código hay 129 pill, 44
 *    `rounded-xl`, 7 `rounded-2xl` y 2 sueltos. El default acá es pill, pero
 *    `radio` deja conservar el de cada pantalla: unificar los 53 que se
 *    desvían es un cambio VISIBLE de diseño y esa decisión no es del refactor.
 *
 * Es puro para poder fijarlo con tests: el repo corre vitest en `node` y no
 * puede renderizar componentes.
 */

export type VarianteDeBoton = 'primario' | 'secundario' | 'navy' | 'fantasma'
export type TamanoDeBoton = 'sm' | 'md' | 'lg'
export type AnchoDeBoton = 'auto' | 'full' | 'flex'
export type RadioDeBoton = 'pill' | 'xl' | '2xl'

/** El color, el hover y el foco de cada familia. */
const VARIANTE: Record<VarianteDeBoton, string> = {
  // AGENTS.md/UI-1: sobre coral el texto va en BLANCO (4.60:1); el hover
  // oscurece a coral-deep (5.35:1). Aclarar rompería AA — ver la cabecera.
  primario: 'bg-coral text-white hover:bg-coral-deep focus-visible:ring-coral',
  // La familia más numerosa después de la primaria: sin fondo propio, borde
  // fantasma, y el fondo aparece solo al pasar por encima.
  secundario: 'border border-[var(--outline-variant)] text-navy-light hover:bg-surface-low focus-visible:ring-navy-light',
  navy: 'bg-navy text-white hover:bg-navy-light focus-visible:ring-navy',
  // Sin caja: es el enlace-acción. El subrayado en hover lo distingue sin
  // depender solo del color.
  fantasma: 'text-teal-deep hover:underline focus-visible:ring-teal-deep',
}

/**
 * El alto y la tipografía. Los tres tamaños salen de lo que el código ya usaba:
 * `md` es el de las barras de acción, `sm` el de las filas de tabla y `lg` el
 * de los CTA a lo ancho de las pantallas de acceso.
 */
const TAMANO: Record<TamanoDeBoton, string> = {
  sm: 'px-3.5 py-2 text-[13px] gap-1.5',
  md: 'px-4 py-2 text-sm gap-1.5',
  lg: 'px-5 py-3.5 text-sm font-semibold gap-2',
}

const ANCHO: Record<AnchoDeBoton, string> = {
  auto: '',
  full: 'w-full',
  flex: 'flex-1',
}

const RADIO: Record<RadioDeBoton, string> = {
  pill: 'rounded-full',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
}

/**
 * Lo que llevan TODOS, y es la parte que más se olvidaba al copiar y pegar:
 *
 * - `focus-visible:ring-2` — el foco visible es requisito de AA y no estaba en
 *   la mayoría de los botones escritos a mano.
 * - `disabled:*` — un control deshabilitado está exento del piso de contraste
 *   (`accessibility.md`), y `pointer-events-none` evita el clic que igual se
 *   dispara cuando el botón es en realidad un `<Link>`.
 * - `whitespace-nowrap` — un botón que parte su etiqueta en dos líneas rompe la
 *   fila donde vive.
 */
const BASE = [
  'inline-flex items-center justify-center whitespace-nowrap font-body',
  'transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:opacity-40 disabled:pointer-events-none',
].join(' ')

export type OpcionesDeBoton = {
  variante?: VarianteDeBoton
  tamano?: TamanoDeBoton
  ancho?: AnchoDeBoton
  /** Por defecto pill, que es la regla del design system. Ver la cabecera. */
  radio?: RadioDeBoton
  /**
   * El halo coral de los CTA grandes. Sale del token `--shadow-pulse` y no de
   * un `rgba(...)` escrito a mano: había botones con el coral RETIRADO metido
   * dentro de la sombra (ver UI-2 en `lib/contrast.test.ts`).
   *
   * El README del design system dice que el primario lo lleva SIEMPRE. En el
   * código lo llevan unos pocos, así que acá va apagado por defecto:
   * encenderlo en todos es un cambio visible y no lo decide un refactor.
   */
  resplandor?: boolean
}

/** Las clases de un botón. Lo que devuelve se concatena con las de quien llama. */
export function clasesDeBoton({
  variante = 'primario',
  tamano = 'md',
  ancho = 'auto',
  radio = 'pill',
  resplandor = false,
}: OpcionesDeBoton = {}): string {
  // La fantasma no tiene caja: ni radio, ni relleno horizontal de botón.
  const caja = variante === 'fantasma' ? '' : `${RADIO[radio]} ${TAMANO[tamano]}`
  const relleno = variante === 'fantasma' ? TAMANO[tamano].replace(/px-[\d.]+/, 'px-2') : ''
  const halo = resplandor ? 'shadow-[var(--shadow-pulse)]' : ''
  return [BASE, VARIANTE[variante], caja || relleno, ANCHO[ancho], halo]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}
