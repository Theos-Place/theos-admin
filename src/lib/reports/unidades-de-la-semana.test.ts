import { describe, it, expect } from 'vitest'
import { etiqueta, reconciliacion, desglosePorHistoria } from './unidades-de-la-semana'

/**
 * REP-15 · El caso que se reportó, semana 40 de 2026, con los números que
 * salieron de producción: 899 check-ins (872 asistente + 27 servidor) de 875
 * personas, de las cuales 839 ya habían venido.
 */
const SEMANA_40 = { checkins: 899, personas: 875, conHistoria: 839 }

describe('REP-15 · reconciliar las dos secciones', () => {
  it('explica por qué 899 y 875 no son el mismo número', () => {
    // Esto es lo que faltaba en la pantalla: los dos números convivían sin
    // nada que dijera que miden cosas distintas, así que se leían como un
    // error de cuadre.
    const f = reconciliacion(SEMANA_40)!
    expect(f).toContain('899')
    expect(f).toContain('875')
    expect(f).toContain('24')
    expect(f).toMatch(/más de una vez/)
  })

  it('sin repetidos no inventa una explicación que nadie necesita', () => {
    expect(reconciliacion({ checkins: 500, personas: 500 })).toBeNull()
  })

  it('no se queja si por alguna razón hay menos check-ins que personas', () => {
    // No debería pasar, pero una frase con número negativo sería peor que
    // no decir nada.
    expect(reconciliacion({ checkins: 10, personas: 12 })).toBeNull()
  })

  it('una sola repetición se lee en singular', () => {
    expect(reconciliacion({ checkins: 101, personas: 100 })).toMatch(/1 vino más de una vez/)
  })
})

describe('quién ya venía y quién no', () => {
  it('la diferencia son los que vinieron por primera vez', () => {
    const d = desglosePorHistoria(SEMANA_40)
    expect(d.primeraVez).toBe(36)
    expect(d.frase).toContain('839')
    expect(d.frase).toContain('36')
  })

  it('si todas ya venían, lo dice en vez de poner un cero', () => {
    expect(desglosePorHistoria({ personas: 100, conHistoria: 100 }).frase)
      .toBe('Todas ya habían venido antes.')
  })

  it('nunca da un número negativo de primerizos', () => {
    expect(desglosePorHistoria({ personas: 10, conHistoria: 12 }).primeraVez).toBe(0)
  })
})

describe('las etiquetas', () => {
  it('check-ins y personas NUNCA se llaman igual', () => {
    // La raíz de REP-15: «asistentes» nombraba a los dos en la misma
    // pantalla, y «check-ins» nombraba a las personas.
    expect(etiqueta(2, 'checkins')).not.toBe(etiqueta(2, 'personas'))
  })

  it('el singular se lee bien', () => {
    expect(etiqueta(1, 'checkins')).toBe('check-in')
    expect(etiqueta(1, 'personas')).toBe('persona')
  })
})
