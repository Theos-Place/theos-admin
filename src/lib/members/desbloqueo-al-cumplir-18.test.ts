import { describe, it, expect } from 'vitest'
import { decidir, repartir, DOMINIO_DE_FUSION, type CuentaBloqueada } from './desbloqueo-al-cumplir-18'

const c = (x: Partial<CuentaBloqueada> & { nombre: string }): CuentaBloqueada => ({
  auth_user_id: x.nombre, email: `${x.nombre}@correo.test`, birth_date: null, ...x,
})

const HOY = '2026-10-01'

describe('decidir', () => {
  it('cumplió 18 justo hoy: se desbloquea', () => {
    expect(decidir(c({ nombre: 'a', birth_date: '2008-10-01' }), HOY)).toEqual({ desbloquear: true })
  })

  it('cumple mañana: todavía no', () => {
    expect(decidir(c({ nombre: 'b', birth_date: '2008-10-02' }), HOY))
      .toEqual({ desbloquear: false, motivo: 'sigue_siendo_menor' })
  })

  it('sin fecha de nacimiento NO se desbloquea: en la duda no se abre una cuenta', () => {
    expect(decidir(c({ nombre: 'c' }), HOY))
      .toEqual({ desbloquear: false, motivo: 'sin_fecha_de_nacimiento' })
  })

  it('las cuentas de fichas fusionadas se quedan bloqueadas para siempre', () => {
    // Están bloqueadas a propósito y su "fecha de nacimiento" podría ser la de
    // un adulto: sin este corte, la fusión se desharía sola.
    expect(decidir(c({ nombre: 'd', birth_date: '1990-01-01', email: `fusionado+x${DOMINIO_DE_FUSION}` }), HOY))
      .toEqual({ desbloquear: false, motivo: 'ficha_fusionada' })
  })

  it('un adulto de hace años también se desbloquea: nunca debió estar bloqueado', () => {
    expect(decidir(c({ nombre: 'e', birth_date: '1980-05-05' }), HOY)).toEqual({ desbloquear: true })
  })
})

describe('repartir', () => {
  it('separa a los que van de los que se quedan, con el motivo', () => {
    const r = repartir([
      c({ nombre: 'mayor', birth_date: '2008-01-01' }),
      c({ nombre: 'menor', birth_date: '2012-01-01' }),
      c({ nombre: 'fusion', birth_date: '1990-01-01', email: `fusionado+y${DOMINIO_DE_FUSION}` }),
      c({ nombre: 'sinfecha' }),
    ], HOY)
    expect(r.desbloquear.map(x => x.nombre)).toEqual(['mayor'])
    expect(r.seQuedan.map(x => `${x.cuenta.nombre}:${x.motivo}`))
      .toEqual(['menor:sigue_siendo_menor', 'fusion:ficha_fusionada', 'sinfecha:sin_fecha_de_nacimiento'])
  })

  it('sin cuentas no revienta', () => {
    expect(repartir([], HOY)).toEqual({ desbloquear: [], seQuedan: [] })
  })
})
