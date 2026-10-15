// UI-1 · Contraste WCAG. Puro, sin dependencias: lo usa el test que fija los
// pares de color del design system.
//
// Existe porque "bajo contraste" era un reporte de uso sin números, y sin
// números no se sabe qué arreglar. Con esto los pares quedan medidos y el test
// falla si alguien reintroduce una combinación que no pasa.

export type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as Rgb
}

/** Luminancia relativa (WCAG 2.x, sRGB). */
export function relativeLuminance(rgb: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
}

/** Razón de contraste entre dos colores opacos. Siempre ≥ 1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)]
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Compone un color con opacidad sobre un fondo.
 *
 * Hace falta porque las clases del sistema son del tipo `text-navy-light/80`: el
 * contraste NO se mide contra el color puro sino contra el resultado de mezclarlo
 * con lo que tiene detrás. Medir el color puro da un número optimista y falso.
 */
export function composite(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as Rgb
}

/** Umbrales AA. El de texto grande solo aplica desde 24px, o 18.66px en negrita. */
export const AA_NORMAL = 4.5

export function ratio(fgHex: string, bgHex: string, alpha = 1): number {
  const bg = hexToRgb(bgHex)
  const fg = alpha === 1 ? hexToRgb(fgHex) : composite(hexToRgb(fgHex), bg, alpha)
  return contrastRatio(fg, bg)
}

/** Los colores del design system, como están en globals.css. */
export const TOKENS = {
  navy: '#161440',
  navyLight: '#29365C',
  coral: '#D63E3D',
  coralDeep: '#C43635',
  coralSoft: '#F78382',
  teal: '#70BDC2',
  tealDeep: '#3B7579',
  /** Teal de texto sobre tintes teal (2026-10-15). */
  tealInk: '#2F5E61',
  tealSoft: '#B5DDE0',
  white: '#FFFFFF',
  surfaceLow: '#F2F4F5',
  /** El papel de las páginas públicas (`bg-[#F8FAFB]`, `--color-surface`). */
  surface: '#F8FAFB',
  surfaceCard: '#FFFFFF',
} as const

/**
 * QA-2/M1 · El color de un rol (o de cualquier categoría) pintado como TEXTO
 * sobre su propio tinte. Los colores de rol son de identificación —el punto,
 * el borde— y la mayoría no llega a 4.5 como letra: el de «Miembro» daba 2.30.
 *
 * En vez de oscurecer la paleta (cambiaría los puntos y los bordes, que están
 * bien), la letra se acerca al navy de a 5 % hasta pasar AA sobre el tinte.
 * El tono se conserva; solo baja la luz lo justo.
 */
export function textoSobreSuTinte(hex: string, alfaTinte: number, papelHex: string = TOKENS.white): string {
  const fondo = composite(hexToRgb(hex), hexToRgb(papelHex), alfaTinte)
  const navy = hexToRgb(TOKENS.navy)
  for (let paso = 0; paso <= 20; paso++) {
    const c = composite(navy, hexToRgb(hex), paso / 20)
    if (contrastRatio(c, fondo) >= AA_NORMAL) return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('')
  }
  return TOKENS.navy
}
