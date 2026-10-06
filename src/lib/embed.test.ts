import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esEmbebible, origenesPermitidos, frameAncestors, EMBEDDABLE_PREFIXES } from './embed'

describe('qué se puede embeber', () => {
  it('el calendario sí', () => {
    expect(esEmbebible('/calendario')).toBe(true)
    expect(esEmbebible('/calendario/abc')).toBe(true)
  })
  it('el resto del sistema NO', () => {
    // Dejarlo embebible habilita clickjacking sobre acciones de alguien con sesión.
    expect(esEmbebible('/miembros')).toBe(false)
    expect(esEmbebible('/finanzas/pagos')).toBe(false)
    expect(esEmbebible('/formularios')).toBe(false)
    expect(esEmbebible('/')).toBe(false)
  })
  it('nada que solo EMPIECE parecido', () => {
    expect(esEmbebible('/calendarios-privados')).toBe(false)
  })
})

describe('origenesPermitidos', () => {
  it('lee una lista separada por coma', () => {
    expect(origenesPermitidos('https://theosplace.com, https://www.theosplace.com'))
      .toEqual(['https://theosplace.com', 'https://www.theosplace.com'])
  })
  it('descarta lo que no es un origen completo', () => {
    // Un valor a medias no falla ruidosamente en frame-ancestors: simplemente
    // no matchea, y el iframe queda roto sin que nadie sepa por qué.
    expect(origenesPermitidos('theosplace.com')).toEqual([])
    expect(origenesPermitidos('https://theosplace.com/calendario')).toEqual([])
    expect(origenesPermitidos('*')).toEqual([])
  })
  it('acepta comodín de subdominio, que frame-ancestors sí entiende', () => {
    // Hace falta para la vista previa de Figma Make, que sirve el sitio desde
    // un subdominio distinto en cada sesión.
    expect(origenesPermitidos('https://*.figma.site')).toEqual(['https://*.figma.site'])
  })
  it('vacío o sin definir da lista vacía', () => {
    expect(origenesPermitidos('')).toEqual([])
    expect(origenesPermitidos(undefined)).toEqual([])
  })
})

describe('frameAncestors', () => {
  const orig = ['https://theosplace.com']
  it('en el calendario suma los orígenes configurados', () => {
    expect(frameAncestors('/calendario', orig)).toBe("frame-ancestors 'self' https://theosplace.com")
  })
  it('fuera del calendario queda como SAMEORIGIN, aunque haya orígenes', () => {
    expect(frameAncestors('/miembros', orig)).toBe("frame-ancestors 'self'")
  })
  it('SIN orígenes configurados no abre nada: activar esto no cambia el estado actual', () => {
    expect(frameAncestors('/calendario', [])).toBe("frame-ancestors 'self'")
  })
})

describe('el header X-Frame-Options no puede contradecir a la lista', () => {
  /**
   * EL BUG (2026-10-06). `next.config.ts` eximía del header a `calendario`
   * ESCRITO A MANO. Cuando SRV-13 agregó `/puestos` a EMBEDDABLE_PREFIXES,
   * la CSP empezó a autorizarla y el header la siguió bloqueando: la
   * cartelera decía ser embebible y no se podía embeber. Una lista en dos
   * lugares se separa, y se separó.
   *
   * El patrón se EVALÚA desde el config real, no se reconstruye acá: un test
   * que arma su propia copia prueba la copia. La primera versión hacía eso y
   * no se enteró cuando se le quitó la frontera al de verdad.
   */
  const cfg = readFileSync('next.config.ts', 'utf8')
  const linea = cfg.split('\n').find(l => l.includes('source:') && l.includes('?!'))

  /** El `source` del config, con EMBEDDABLE_PREFIXES ya interpolado. */
  const patronReal = (): string => {
    expect(linea, 'no se encontró el source con el lookahead').toBeTruthy()
    const expr = linea!.slice(linea!.indexOf('source:') + 'source:'.length).trim().replace(/,$/, '')
    // Es un template literal con una interpolación: se evalúa con la lista
    // de verdad, que es exactamente lo que hace Next al arrancar.
    return Function('EMBEDDABLE_PREFIXES', `return ${expr}`)(EMBEDDABLE_PREFIXES) as string
  }

  it('la excepción se DERIVA de EMBEDDABLE_PREFIXES', () => {
    expect(cfg).toContain('EMBEDDABLE_PREFIXES')
    expect(cfg).not.toContain("source: '/((?!calendario).*)'")
  })

  it('todo lo embebible queda fuera del header', () => {
    const re = new RegExp(`^${patronReal()}$`)
    for (const p of EMBEDDABLE_PREFIXES) {
      expect(re.test(p), `${p} debería quedar exento`).toBe(false)
      expect(re.test(`${p}/algo`), `${p}/algo debería quedar exento`).toBe(false)
    }
  })

  it('y lo que NO es embebible sigue bloqueado', () => {
    const re = new RegExp(`^${patronReal()}$`)
    for (const p of ['/miembros', '/finanzas/pagos', '/estudios/grupos', '/']) {
      expect(re.test(p), p).toBe(true)
    }
  })

  it('un prefijo NO exime a lo que solo empieza igual', () => {
    // Sin la frontera `(?:$|/)`, `/puestos` eximiría a `/puestos-internos` y
    // una ruta futura nacería embebible sin que nadie lo decidiera.
    const re = new RegExp(`^${patronReal()}$`)
    for (const p of EMBEDDABLE_PREFIXES) {
      expect(re.test(`${p}-internos`), `${p}-internos NO debería quedar exento`).toBe(true)
    }
  })

  it('el header y `esEmbebible` dicen lo MISMO', () => {
    // Son las dos mitades del mismo permiso: si se separan, una ruta queda
    // autorizada por la CSP y bloqueada por el header, que es el bug.
    const re = new RegExp(`^${patronReal()}$`)
    for (const p of ['/puestos', '/puestos/abc', '/calendario', '/miembros', '/puestos-internos', '/']) {
      expect(re.test(p), p).toBe(!esEmbebible(p))
    }
  })
})
