import { describe, it, expect } from 'vitest'
import {
  ventanaDeAbandono, esAbandono, abandonos, sedeDeLaSemana, SEMANAS_DE_CORTE,
  type AsistenteDeLaSemana,
} from './abandonos'

// Semana 2026-W38 = lunes 14 de setiembre a domingo 20.
const W38 = { year: 2026, week: 38 }

describe('ventanaDeAbandono', () => {
  it('la ventana cierra el domingo de la semana N+5', () => {
    // W38 = 14–20 set. N+5 = W43 = 19–25 de octubre.
    expect(ventanaDeAbandono(W38, '2026-12-01').finDeLaVentana).toBe('2026-10-25')
  })

  it('no es evaluable mientras la semana N+5 no haya terminado', () => {
    const v = ventanaDeAbandono(W38, '2026-10-20')
    expect(v.evaluable).toBe(false)
    expect(v.faltanSemanas).toBe(1)
  })

  it('el mismo domingo TODAVÍA no: la semana cierra cuando termina', () => {
    // Alguien puede venir ese domingo y aparecer en la lista por unas horas.
    expect(ventanaDeAbandono(W38, '2026-10-25').evaluable).toBe(false)
  })

  it('el lunes siguiente ya se puede', () => {
    expect(ventanaDeAbandono(W38, '2026-10-26').evaluable).toBe(true)
  })

  it('recién pasada la semana N faltan las 5 completas', () => {
    expect(ventanaDeAbandono(W38, '2026-09-21').faltanSemanas).toBe(SEMANAS_DE_CORTE)
  })

  it('la semana 1 que arranca en diciembre no rompe el cálculo', () => {
    // 2026-W01 empieza el 29 de diciembre de 2025 (ISO de verdad).
    expect(ventanaDeAbandono({ year: 2026, week: 1 }, '2026-06-01').finDeLaVentana).toBe('2026-02-08')
  })
})

describe('esAbandono', () => {
  const FIN = '2026-10-25'

  it('no volvió nunca: es abandono', () => {
    expect(esAbandono(null, FIN)).toBe(true)
  })

  it('volvió dentro de la ventana: NO es abandono', () => {
    // Asistió y volvió en N+3.
    expect(esAbandono('2026-10-11', FIN)).toBe(false)
  })

  it('el último día de la ventana todavía cuenta como que volvió', () => {
    expect(esAbandono(FIN, FIN)).toBe(false)
  })

  it('volvió en N+7: cortó las 5, así que sí es abandono', () => {
    expect(esAbandono('2026-11-08', FIN)).toBe(true)
  })
})

describe('abandonos', () => {
  const p = (n: Partial<AsistenteDeLaSemana> & { nombre: string }): AsistenteDeLaSemana => ({
    member_id: n.nombre, sedes: ['Sede Cartago'], telefono: null, email: null, regreso: null, ...n,
  })
  const FIN = '2026-10-25'

  it('deja fuera a quien volvió dentro de la ventana', () => {
    const r = abandonos([p({ nombre: 'Ana', regreso: '2026-10-04' }), p({ nombre: 'Beto' })], FIN)
    expect(r.map(x => x.nombre)).toEqual(['Beto'])
  })

  it('primero los que no han vuelto: son los que hay que llamar', () => {
    const r = abandonos([
      p({ nombre: 'Ana', regreso: '2026-11-02' }),
      p({ nombre: 'Zulema' }),
      p({ nombre: 'Beto' }),
    ], FIN)
    expect(r.map(x => x.nombre)).toEqual(['Beto', 'Zulema', 'Ana'])
    expect(r[2].volvioEl).toBe('2026-11-02')
  })

  it('volvioEl queda en null para quien no volvió', () => {
    expect(abandonos([p({ nombre: 'Ana' })], FIN)[0].volvioEl).toBeNull()
  })

  it('sin asistentes devuelve vacío, no null', () => {
    expect(abandonos([], FIN)).toEqual([])
  })
})

describe('sedeDeLaSemana', () => {
  it('si asistió a dos sedes se muestran las dos', () => {
    // Elegir "la más frecuente" escondería que estuvo en dos.
    expect(sedeDeLaSemana(['Sede Madrid', 'Sede Cartago'])).toBe('Sede Cartago, Sede Madrid')
  })

  it('no repite la sede cuando fue dos veces al mismo lugar', () => {
    expect(sedeDeLaSemana(['Sede Cartago', 'Sede Cartago'])).toBe('Sede Cartago')
  })

  it('sin sedes queda vacío', () => {
    expect(sedeDeLaSemana([])).toBe('')
  })
})
