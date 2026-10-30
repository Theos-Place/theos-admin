import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { ratio, contrastRatio, hexToRgb, composite, AA_NORMAL, TOKENS, textoSobreSuTinte } from './contrast'
import { ROLES } from './auth/roles'

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
    // 4.550 — pasa por un 1%. Ver abajo: sobre el papel ya NO pasa.
    ['coral como texto sobre blanco',    () => ratio(TOKENS.coral, TOKENS.surfaceCard)],
    // QA-1/M2 · El papel de las públicas es #F8FAFB, no blanco. Ahí el texto
    // de acento va en coral-deep.
    ['coral-deep como texto sobre papel', () => ratio(TOKENS.coralDeep, TOKENS.surface)],
    ['teal-deep como texto sobre papel',  () => ratio(TOKENS.tealDeep, TOKENS.surface)],
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

  it('coral como TEXTO sobre el papel no llega: por eso /terminos usa coral-deep', () => {
    // 4.346 contra el 4.5 de AA. El margen del coral sobre blanco es de 4.550,
    // o sea un 1%: cualquier superficie que no sea blanco pura lo tumba. Es lo
    // que hacía fallar los seis enlaces mailto del documento de términos.
    expect(ratio(TOKENS.coral, TOKENS.surface)).toBeLessThan(AA_NORMAL)
  })

  it('navy-light por debajo de /80 no alcanza', () => {
    expect(ratio(TOKENS.navyLight, TOKENS.white, 0.6)).toBeLessThan(AA_NORMAL)
    expect(ratio(TOKENS.navyLight, TOKENS.white, 0.5)).toBeLessThan(AA_NORMAL)
  })
})

// QA-1/M2 · Los fondos TEÑIDOS son dos composiciones, no una: primero el tinte
// sobre el papel, después el texto sobre ese resultado. `ratio()` solo compone
// una vez, así que estos pares se arman a mano.
//
// El hallazgo: `/terminos` tenía `text-teal-deep/90` sobre `bg-teal-soft/20` y
// daba 3.87. El color pleno da 4.69 — pasa, pero con poco margen, y ESA es la
// razón de que el /90 esté prohibido arriba: el tinte ya se comió el colchón,
// no queda nada para gastar en opacidad. Las otras nueve pantallas que usan
// este par ya lo tenían pleno; `/terminos` era la excepción.
describe('texto sobre fondos teñidos', () => {
  const sobreTinte = (fgHex: string, tinteHex: string, alfaTinte: number, papelHex: string, alfaTexto = 1) => {
    const fondo = composite(hexToRgb(tinteHex), hexToRgb(papelHex), alfaTinte)
    const fg = alfaTexto === 1 ? hexToRgb(fgHex) : composite(hexToRgb(fgHex), fondo, alfaTexto)
    return contrastRatio(fg, fondo)
  }

  it('teal-deep pleno sobre teal-soft/20, en el papel de las públicas', () => {
    expect(sobreTinte(TOKENS.tealDeep, TOKENS.tealSoft, 0.2, TOKENS.surface))
      .toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('teal-deep pleno sobre teal-soft/20, en una tarjeta blanca', () => {
    expect(sobreTinte(TOKENS.tealDeep, TOKENS.tealSoft, 0.2, TOKENS.surfaceCard))
      .toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('con /90 NO pasaba: por eso se le quitó a /terminos', () => {
    expect(sobreTinte(TOKENS.tealDeep, TOKENS.tealSoft, 0.2, TOKENS.surface, 0.9))
      .toBeLessThan(AA_NORMAL)
  })

  it('teal-deep pleno sobre teal-soft/25, el tinte más fuerte que se usa', () => {
    expect(sobreTinte(TOKENS.tealDeep, TOKENS.tealSoft, 0.25, TOKENS.surfaceCard))
      .toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('coral-deep sobre el tinte coral, que es la otra pareja teñida del sistema', () => {
    // AGENTS.md: sobre un tinte coral el texto va en coral-deep, no en coral.
    expect(sobreTinte(TOKENS.coralDeep, TOKENS.coral, 0.1, TOKENS.surfaceCard))
      .toBeGreaterThanOrEqual(AA_NORMAL)
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
    // `text-[8px]` no estaba en la lista y había uno vivo en el calendario
    // (el "+N" de los días con muchos eventos). El piso es 11px para micro-
    // labels; por debajo de 9 ni siquiera hacía falta discutirlo.
    'text-gray-400', 'text-[7px]', 'text-[8px]', 'text-[9px]', 'text-[10px]',
    'bg-teal text-white',
    // QA-1/M2 · Sobre un tinte el teal-deep ya arranca en 4.69: cualquier
    // opacidad encima lo baja de AA. Al /90 daba 3.87.
    'text-teal-deep/90', 'text-teal-deep/80',
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

// El calendario público pinta con rgba porque su fondo es configurable (?bg=),
// así que no usa los tokens: sus alfas se vigilan acá aparte.
describe('calendario público: el texto informativo pasa AA', () => {
  const BLANCO = '#FFFFFF'

  it('0.65 es el alfa que se usa, y pasa con margen', () => {
    expect(ratio('#000000', BLANCO, 0.65)).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('los alfas que había NO pasaban: por eso se subieron', () => {
    // Reportado por el usuario sobre "📍 Theos Pedregal, Belén · 🕐 5 sep".
    expect(ratio('#000000', BLANCO, 0.4)).toBeLessThan(AA_NORMAL)   // 2.85:1 lugar y hora
    expect(ratio('#000000', BLANCO, 0.3)).toBeLessThan(AA_NORMAL)   // 2.10:1 día de la semana
    expect(ratio('#000000', BLANCO, 0.45)).toBeLessThan(AA_NORMAL)  // 3.36:1 hora del modal
  })

  it('sigue pasando sobre los fondos claros que alguien puede configurar', () => {
    expect(ratio('#000000', '#FFF8F0', 0.65)).toBeGreaterThanOrEqual(AA_NORMAL) // crema
    expect(ratio('#000000', '#F5F5F5', 0.65)).toBeGreaterThanOrEqual(AA_NORMAL) // gris claro
  })

  it('el contador del encabezado, blanco sobre el navy, ya pasaba', () => {
    expect(ratio('#FFFFFF', TOKENS.navy, 0.6)).toBeGreaterThanOrEqual(AA_NORMAL)
  })
})

/**
 * UI-2 · El coral retirado no vuelve.
 *
 * #EF5554 salió de la marca por contraste: 3.44:1 sobre blanco, que no pasa AA.
 * El vigente es #D63E3D con 4.55:1. Vivía todavía en 21 SVG de ayuda —el plan
 * decía 10, eran más—, así que las infografías enseñaban un color que el resto
 * del sistema ya no usa Y que no se lee bien.
 */
describe('UI-2 · el coral retirado no vuelve', () => {
  const CORAL_RETIRADO = '#EF5554'
  const CORAL_VIGENTE = '#D63E3D'

  it('el retirado NO pasa AA sobre blanco; el vigente sí — por eso se cambió', () => {
    expect(contrastRatio(hexToRgb(CORAL_RETIRADO), hexToRgb('#ffffff'))).toBeLessThan(AA_NORMAL)
    expect(contrastRatio(hexToRgb(CORAL_VIGENTE), hexToRgb('#ffffff'))).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('ningún archivo de public/ lo usa', () => {
    const salida = execSync(`grep -rl "${CORAL_RETIRADO.slice(1)}" public/ || true`, { encoding: 'utf8' })
    expect(salida.split('\n').filter(Boolean)).toEqual([])
  }, 30_000) // grep sobre src/ y public/: con la suite completa en paralelo pasa de 5 s

  it('ni el código fuente, fuera de este test', () => {
    const salida = execSync(`grep -rl "${CORAL_RETIRADO.slice(1)}" src/ || true`, { encoding: 'utf8' })
    expect(salida.split('\n').filter(Boolean).filter(f => !f.includes('contrast.test'))).toEqual([])
  })

  /**
   * QA-1/N3 · El mismo color escrito como rgb tampoco.
   *
   * PUNTO CIEGO que tenía esta guardia: vigilaba el hex y nada más, así que
   * `rgba(239, 85, 84, 0.28)` —que es el MISMO color— pasaba libre. Estaba en
   * **60 lugares de 31 archivos**, incluido el token `--shadow-pulse` de
   * globals.css, o sea que el halo del botón primario seguía siendo el color
   * retirado trece meses después de retirarlo.
   *
   * Son tintes y sombras, no texto, así que no había falla de contraste: lo que
   * había era la mitad de un cambio sin terminar. Barridos el 2026-09-22.
   */
  it('ni escrito como rgb, que era por donde se colaba', () => {
    const [r, g, b] = hexToRgb(CORAL_RETIRADO)
    const salida = execSync(
      `grep -rlE "${r}, ?${g}, ?${b}" src/ public/ || true`, { encoding: 'utf8' })
    expect(salida.split('\n').filter(Boolean).filter(f => !f.includes('contrast.test'))).toEqual([])
  }, 30_000) // grep sobre src/ y public/: con la suite completa en paralelo pasa de 5 s
})

/**
 * CHK-2 · El aviso de cumpleaños del check-in.
 *
 * Es texto coral-deep sobre un tinte `bg-coral/10` puesto sobre la tarjeta
 * blanca. Se mide y no se estima: con coral a secas el par da 3.97:1 y NO
 * pasaría — es exactamente la trampa que AGENTS.md advierte sobre los tintes
 * coral, y la diferencia entre las dos clases es una letra.
 */
describe('CHK-2 · el aviso de cumpleaños se lee', () => {
  const fondo = composite(hexToRgb(TOKENS.coral), hexToRgb(TOKENS.surfaceCard), 0.10)

  it('coral-deep sobre el tinte pasa AA', () => {
    expect(contrastRatio(hexToRgb(TOKENS.coralDeep), fondo)).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('y coral a secas NO pasaría: por eso la clase es coral-deep', () => {
    expect(contrastRatio(hexToRgb(TOKENS.coral), fondo)).toBeLessThan(AA_NORMAL)
  })
})

/**
 * REU-2 · La insignia «En espera» de la cola de solicitudes.
 *
 * Medido y no estimado, y la primera versión NO pasaba: `text-teal-deep` sobre
 * el tinte teal al 14% da 4.37:1, a una décima de la línea. Es la misma trampa
 * que el tinte coral — el color de marca se ve bien sobre su propio tinte y
 * justo por eso no contrasta. El texto quedó un paso más oscuro.
 */
describe('REU-2 · la insignia «En espera» se lee', () => {
  const TINTE_TEAL = '#3B7579'
  const TEXTO_EN_ESPERA = '#2F5C5F'
  const fondo = composite(hexToRgb(TINTE_TEAL), hexToRgb(TOKENS.surfaceCard), 0.14)

  it('el texto que quedó pasa AA', () => {
    expect(contrastRatio(hexToRgb(TEXTO_EN_ESPERA), fondo)).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('y el teal-deep de marca NO pasaría sobre su propio tinte', () => {
    expect(contrastRatio(hexToRgb(TINTE_TEAL), fondo)).toBeLessThan(AA_NORMAL)
  })
})

// QA-2/M1 (2026-10-15) · Los seis pares que explicaban 268 elementos bajo AA en
// 39 pantallas. Cada uno con el número de antes, para que nadie lo reintroduzca.
describe('QA-2/M1 · los seis pares que fallaban, ya arreglados', () => {
  const sobreTinte = (fg: string, tinte: string, alfa: number, papel: string = TOKENS.white) =>
    contrastRatio(hexToRgb(fg), composite(hexToRgb(tinte), hexToRgb(papel), alfa))

  it('subtítulo de página (.psub) y --fg-muted: navy-light/80 (antes 0.55 → 3.18 y 0.5 → 2.78)', () => {
    const css = readFileSync('src/app/globals.css', 'utf8')
    expect(css).toMatch(/\.psub \{[^}]*color: rgba\(41, 54, 92, 0\.8\)/)
    expect(css).toMatch(/--fg-muted:\s+rgba\(41, 54, 92, 0\.8\)/)
    // La etiqueta de los formularios, mismo caso (era 0.6 → 3.62).
    expect(css).toMatch(/\.form-label \{[^}]*color: rgba\(41, 54, 92, 0\.8\)/)
    expect(ratio(TOKENS.navyLight, TOKENS.white, 0.8)).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('verde como texto: success-deep sobre su tinte /12 (el #3DB97A daba 2.25)', () => {
    expect(sobreTinte('#3DB97A', '#3DB97A', 0.12)).toBeLessThan(AA_NORMAL)
    expect(sobreTinte('#1E6B42', '#3DB97A', 0.12)).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('ámbar como texto: #7F6210 sobre su tinte /15 (el #A8821F daba 3.29)', () => {
    expect(sobreTinte('#A8821F', '#E9B949', 0.15)).toBeLessThan(AA_NORMAL)
    expect(sobreTinte('#7F6210', '#E9B949', 0.15)).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('coral-deep sobre coral /10 pasa; sobre /15 NO: por eso los chips bajaron a /10', () => {
    expect(sobreTinte(TOKENS.coral, TOKENS.coral, 0.1)).toBeLessThan(AA_NORMAL)
    expect(sobreTinte(TOKENS.coralDeep, TOKENS.coral, 0.1)).toBeGreaterThanOrEqual(AA_NORMAL)
    expect(sobreTinte(TOKENS.coralDeep, TOKENS.coral, 0.15)).toBeLessThan(AA_NORMAL)
  })

  it('el texto de CADA rol pasa sobre su tinte (el de «Miembro» daba 2.30)', () => {
    for (const r of ROLES) {
      const fg = textoSobreSuTinte(r.color, 0x18 / 255)
      expect(sobreTinte(fg, r.color, 0x18 / 255), r.id).toBeGreaterThanOrEqual(AA_NORMAL)
    }
  })

  it('teal-ink pasa sobre todos los tintes teal, en blanco, papel y gris', () => {
    for (const papel of [TOKENS.white, TOKENS.surface, TOKENS.surfaceLow]) {
      for (const [tinte, alfa] of [[TOKENS.tealSoft, 0.3], [TOKENS.tealSoft, 0.4], [TOKENS.tealDeep, 0.15], ['#519DA2', 0.12], [TOKENS.teal, 0.2]] as const) {
        expect(sobreTinte(TOKENS.tealInk, tinte, alfa, papel)).toBeGreaterThanOrEqual(AA_NORMAL)
      }
    }
    // Y por qué hizo falta: teal-deep sobre teal-soft/40 en una tarjeta gris.
    expect(sobreTinte(TOKENS.tealDeep, TOKENS.tealSoft, 0.4, TOKENS.surfaceLow)).toBeLessThan(AA_NORMAL)
  })

  it('coral-deep como texto pasa sobre blanco, papel y gris', () => {
    for (const papel of [TOKENS.white, TOKENS.surface, TOKENS.surfaceLow]) {
      expect(ratio(TOKENS.coralDeep, papel)).toBeGreaterThanOrEqual(AA_NORMAL)
    }
  })

  it('el chip gris de «Miembro» en /accesos: #5F6378 sobre #9CA0B4/15', () => {
    expect(sobreTinte('#5F6378', '#9CA0B4', 0.15)).toBeGreaterThanOrEqual(AA_NORMAL)
  })
})

describe('QA-2/M1 · las combinaciones retiradas no vuelven al código', () => {
  // Se barre en JS y no con grep: los patrones llevan comillas y backticks que
  // la shell interpreta.
  const archivos = execSync('git ls-files src', { encoding: 'utf8' }).split('\n')
    .filter(f => /\.(tsx?)$/.test(f) && !/\.test\./.test(f))
  const buscar = (re: RegExp) => archivos.flatMap(f => {
    const lineas = readFileSync(f, 'utf8').split('\n')
    return lineas.flatMap((l, i) => (re.test(l) ? [`${f}:${i + 1}`] : []))
  })
  // Un string de clases (entre comillas) que pone texto coral sobre un tinte
  // coral estático. `hover:bg-coral/5` no cuenta: es un estado, no el reposo.
  const coralSobreTinte = (l: string) => [...l.matchAll(/(['"`])([^'"`]*)\1/g)].some(([, , c]) =>
    /(^|\s)(bg-coral(-soft)?\/\d+|bg-\[rgba\(214,\s?62,\s?61)/.test(c) && /(^|\s)text-coral(?![-\w/])/.test(c))
  const coralDeepSobreTinteFuerte = (l: string) => [...l.matchAll(/(['"`])([^'"`]*)\1/g)].some(([, , c]) =>
    /(^|\s)bg-coral\/(1[5-9]|[2-9]\d)\b/.test(c) && /(^|\s)text-coral-deep\b/.test(c))

  // Decisión de Floriana, 2026-10-15: el coral de TEXTO es coral-deep en toda
  // la app. El coral pleno daba 4.35 sobre el fondo gris de página y 4.55
  // sobre blanco (al filo). Quedan permitidos con opacidad: son íconos.
  it('el coral como texto es siempre coral-deep', () => {
    expect(buscar(/(^|[\s'"`:])text-coral(?![-\w/])/)).toEqual([])
  })
  // Decisión de Floriana, 2026-10-15: sobre un tinte teal, la letra va en
  // teal-ink. teal-deep daba 3.93 en el peor caso.
  it('teal-deep nunca va como texto sobre un tinte teal', () => {
    const tealSobreTinte = (l: string) => [...l.matchAll(/(['"`])([^'"`]*)\1/g)].some(([, , c]) =>
      /(^|[\s:])(bg-teal(-soft|-deep)?\/\d+|bg-\[rgba\((81,\s?157,\s?162|112,\s?189,\s?194|59,\s?117,\s?121))/.test(c)
      && /(^|[\s:])text-teal-deep(?![-\w/])/.test(c))
    expect(archivos.flatMap(f => readFileSync(f, 'utf8').split('\n')
      .flatMap((l, i) => (tealSobreTinte(l) ? [`${f}:${i + 1}`] : [])))).toEqual([])
  })
  it('nadie pinta el verde #3DB97A como texto', () => {
    expect(buscar(/text-\[#3DB97A\]/)).toEqual([])
  })
  it('nadie pinta texto navy a 0.65 o menos escrito como rgba (0.60 daba 4.2; era la vía de escape de la regla de /50-/70)', () => {
    expect(buscar(/text-\[rgba\(22, ?20, ?64, ?0?\.(?:[0-5]\d?|6[0-5]?)\)\]/)).toEqual([])
  })
  it('ni el morado #7C5EC2 ni el ámbar #C08A00 (2.81 sobre su tinte)', () => {
    expect(buscar(/#7C5EC2|#C08A00/)).toEqual([])
  })
  it('nadie pinta el ámbar #A8821F', () => {
    expect(buscar(/#A8821F/)).toEqual([])
  })
  it('ningún chip pone text-coral sobre un tinte coral', () => {
    expect(archivos.flatMap(f => readFileSync(f, 'utf8').split('\n')
      .flatMap((l, i) => (coralSobreTinte(l) ? [`${f}:${i + 1}`] : [])))).toEqual([])
  })
  it('ni coral-deep sobre un tinte de /15 para arriba (no llega a 4.5)', () => {
    expect(archivos.flatMap(f => readFileSync(f, 'utf8').split('\n')
      .flatMap((l, i) => (coralDeepSobreTinteFuerte(l) ? [`${f}:${i + 1}`] : [])))).toEqual([])
  })
})
