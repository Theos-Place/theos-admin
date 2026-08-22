import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { ratio, contrastRatio, hexToRgb, composite, AA_NORMAL, TOKENS } from './contrast'

describe('la matemática, contra valores conocidos', () => {
  it('negro sobre blanco es 21', () => {
    expect(contrastRatio(hexToRgb('#000000'), hexToRgb('#FFFFFF'))).toBeCloseTo(21, 1)
  })

  it('un color contra sí mismo es 1', () => {
    expect(contrastRatio(hexToRgb('#D63E3D'), hexToRgb('#D63E3D'))).toBeCloseTo(1, 5)
  })

  // El punto de composite(): medir el color puro da un número falso.
  it('la opacidad cambia el resultado, y por eso hay que componer', () => {
    const puro = ratio(TOKENS.navyLight, TOKENS.white)
    const con80 = ratio(TOKENS.navyLight, TOKENS.white, 0.8)
    expect(puro).toBeGreaterThan(con80)
    expect(composite(hexToRgb('#000000'), hexToRgb('#FFFFFF'), 0.5)).toEqual([128, 128, 128])
  })
})

// UI-1 · Cada par que el sistema realmente usa. Si alguien reintroduce una
// combinación que no pasa, este test lo dice con el número.
describe('los pares del design system pasan AA para texto normal', () => {
  const PARES: Array<[string, () => number]> = [
    // El más usado de todos: 2092 veces al 2026-08-21.
    ['navy-light/80 sobre blanco',       () => ratio(TOKENS.navyLight, TOKENS.surfaceCard, 0.8)],
    ['navy-light/80 sobre surface-low',  () => ratio(TOKENS.navyLight, TOKENS.surfaceLow, 0.8)],
    // Coral es la acción primaria: con el #EF5554 anterior daba 3.44 y fallaba.
    ['blanco sobre coral',               () => ratio(TOKENS.white, TOKENS.coral)],
    ['blanco sobre coral-deep',          () => ratio(TOKENS.white, TOKENS.coralDeep)],
    ['coral como texto sobre blanco',    () => ratio(TOKENS.coral, TOKENS.surfaceCard)],
    // El teal claro es fondo de chips: va con texto navy, no blanco (daba 2.15).
    ['navy sobre teal',                  () => ratio(TOKENS.navy, TOKENS.teal)],
    ['blanco sobre teal-deep',           () => ratio(TOKENS.white, TOKENS.tealDeep)],
    ['blanco sobre navy',                () => ratio(TOKENS.white, TOKENS.navy)],
  ]

  for (const [nombre, medir] of PARES) {
    it(nombre, () => {
      expect(medir()).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }
})

describe('las combinaciones que se retiraron siguen fuera', () => {
  it('blanco sobre el coral viejo no pasaba, y por eso se cambió', () => {
    expect(ratio(TOKENS.white, '#EF5554')).toBeLessThan(AA_NORMAL)
  })

  it('blanco sobre el teal-deep viejo tampoco', () => {
    expect(ratio(TOKENS.white, '#519DA2')).toBeLessThan(AA_NORMAL)
  })

  it('blanco sobre el teal claro nunca sirvió', () => {
    expect(ratio(TOKENS.white, TOKENS.teal)).toBeLessThan(AA_NORMAL)
  })

  it('navy-light por debajo de /80 no alcanza', () => {
    expect(ratio(TOKENS.navyLight, TOKENS.white, 0.6)).toBeLessThan(AA_NORMAL)
    expect(ratio(TOKENS.navyLight, TOKENS.white, 0.5)).toBeLessThan(AA_NORMAL)
  })
})

// Estos son de CÓDIGO: la regla es "qué clases no deben existir", no un cálculo.
describe('las clases retiradas no volvieron al código', () => {
  // Las clases prohibidas, cada una con su porqué medido:
  //   /50 → 2.78 · /60 → 3.62 · /70 → 4.78 (al filo, y ya se había retirado)
  //   gray-400 → fuera del sistema · 9-10px → bajo el piso de tamaño
  //   bg-teal text-white → 2.15
  //
  // `/40` NO está acá: es el nivel de lo DECORATIVO (separadores «·», íconos con
  // aria-hidden) y de los controles DESHABILITADOS, y las dos cosas están
  // exentas de AA. Un intento de "arreglarlas" solo oscurece la jerarquía visual
  // sin que nadie lea mejor — pasó al hacer este cambio y hubo que revertirlo.
  const PROHIBIDAS = [
    'text-navy-light/50', 'text-navy-light/60', 'text-navy-light/70',
    'text-gray-400', 'text-[9px]', 'text-[10px]',
    'bg-teal text-white',
  ]
  const encontradas = () => {
    const patron = PROHIBIDAS.map(c => c.replace(/[[\]]/g, m => '\\' + m)).join('|')
    const out = execSync(
      `grep -rEo '${patron}' src --include='*.tsx' || true`,
      { encoding: 'utf8', cwd: process.cwd() },
    ).trim()
    return out ? out.split('\n') : []
  }

  it('sin opacidades bajas, sin grises, sin 9-10px, sin blanco sobre teal', () => {
    expect(encontradas()).toEqual([])
  })

  it('los tokens del CSS son los medidos acá', () => {
    const css = readFileSync('src/app/globals.css', 'utf8')
    expect(css).toContain(`--color-coral:         ${TOKENS.coral};`)
    expect(css).toContain(`--color-coral-deep:    ${TOKENS.coralDeep};`)
    expect(css).toContain(`--color-teal-deep:     ${TOKENS.tealDeep};`)
    // La identidad no cambió: el navy y el teal claro son los de siempre. Solo
    // se movieron los dos tonos DERIVADOS (coral y teal-deep).
    expect(css).toContain(`--color-navy:          ${TOKENS.navy};`)
    expect(css).toContain(`--brand-teal:         ${TOKENS.teal};`)
  })
})
