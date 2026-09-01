import { describe, it, expect } from 'vitest'
import { excepcionVigente, etiquetaVigencia, perdona } from './exception-scope'

describe('perdona', () => {
  it('perdona lo que se marcó', () => {
    expect(perdona(['donor'], 'donor')).toBe(true)
    expect(perdona(['donor'], 'age')).toBe(false)
  })

  it('"all" cubre los requisitos de entrada', () => {
    for (const r of ['donor', 'attendance', 'server', 'prerequisite', 'age'] as const) {
      expect(perdona(['all'], r), r).toBe(true)
    }
  })

  it('pero "all" NO habilita repetir un curso', () => {
    // Perdonar lo que le falta a alguien y habilitarle un curso que ya aprobó
    // son decisiones distintas. Quien otorga tiene que marcar esta.
    expect(perdona(['all'], 'repetir')).toBe(false)
    expect(perdona(['repetir'], 'repetir')).toBe(true)
  })

  it('sin nada, no perdona nada', () => {
    expect(perdona([], 'donor')).toBe(false)
    expect(perdona(null, 'repetir')).toBe(false)
  })
})

describe('excepcionVigente', () => {
  const hoy = '2026-09-01'

  it('revocada o usada nunca está vigente', () => {
    for (const status of ['revoked', 'used']) {
      expect(excepcionVigente({ status, cierreMatricula: '2026-12-31', hoy }), status).toBe(false)
    }
  })

  it('activa dentro del bloque, vigente', () => {
    expect(excepcionVigente({ status: 'active', cierreMatricula: '2026-09-13', hoy })).toBe(true)
  })

  it('el día del cierre TODAVÍA vale', () => {
    // La matrícula está abierta hasta ese día inclusive; la excepción dura lo
    // mismo. Cortarla un día antes deja a alguien afuera en el último día.
    expect(excepcionVigente({ status: 'active', cierreMatricula: hoy, hoy })).toBe(true)
  })

  it('pasado el cierre, ya no', () => {
    expect(excepcionVigente({ status: 'active', cierreMatricula: '2026-08-31', hoy })).toBe(false)
  })

  it('sin bloque no caduca (las de antes del cambio)', () => {
    // No se les cambia el trato por retroactividad: se otorgaron bajo la regla
    // vieja, en la que no vencían.
    expect(excepcionVigente({ status: 'active', cierreMatricula: null, hoy })).toBe(true)
  })
})

describe('etiquetaVigencia', () => {
  const hoy = '2026-09-01'
  it('dice hasta cuándo, con el nombre del bloque', () => {
    expect(etiquetaVigencia({ cierreMatricula: '2026-09-13', bloqueNombre: 'Bloque 3 2026', hoy }))
      .toBe('Vence al cerrar Bloque 3 2026 (13/9/2026)')
  })
  it('sin bloque lo dice claro', () => {
    expect(etiquetaVigencia({ cierreMatricula: null, hoy })).toBe('Sin vencimiento')
  })
  it('vencida se ve como vencida', () => {
    expect(etiquetaVigencia({ cierreMatricula: '2026-08-01', hoy })).toBe('Vencida el 1/8/2026')
  })
})
