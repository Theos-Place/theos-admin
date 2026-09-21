import { describe, it, expect } from 'vitest'
import {
  ventanaHaciaAtras, esAbandono, abandonos, asistentes, esAsistente, sedeDeLaSemana,
  SEMANAS_DE_CORTE, VISITAS_MINIMAS, INFO_ASISTIERON, INFO_DEJARON,
  type AsistenteDeLaSemana,
} from './abandonos'

// 2026-W38 = lunes 14 de setiembre a domingo 20.
const W38 = { year: 2026, week: 38 }

describe('ventanaHaciaAtras', () => {
  it('la lista sale de la semana N-5, no de la N', () => {
    // Al abrir el 14–20 set se pregunta por quienes vinieron el 10–16 de agosto.
    const v = ventanaHaciaAtras(W38)
    expect(v.semanaDeReferencia).toEqual({ year: 2026, week: 33 })
    expect(v.desde).toBe('2026-08-10')
    expect(v.hasta).toBe('2026-08-16')
  })

  it('la espera termina el domingo de la semana que se está mirando', () => {
    expect(ventanaHaciaAtras(W38).finDeLaEspera).toBe('2026-09-20')
  })

  it('cruzar el año hacia atrás no rompe el número de semana', () => {
    // La semana 2 de 2026 menos 5 NO es la semana -3: es la 49 de 2025.
    const v = ventanaHaciaAtras({ year: 2026, week: 2 })
    expect(v.semanaDeReferencia).toEqual({ year: 2025, week: 49 })
    expect(v.desde).toBe('2025-12-01')
  })

  it('siempre se puede calcular, también para la semana en curso', () => {
    // Era el punto del cambio: antes la semana actual no tenía respuesta.
    const v = ventanaHaciaAtras({ year: 2026, week: 52 })
    expect(v.desde < v.hasta && v.hasta < v.finDeLaEspera).toBe(true)
  })
})

describe('asistente contra visitante', () => {
  it(`hacen falta ${VISITAS_MINIMAS} visitas`, () => {
    expect(esAsistente({ visitas: 1 })).toBe(false)
    expect(esAsistente({ visitas: 2 })).toBe(true)
  })

  it('quien vino por primera vez no entra en la lista', () => {
    const filas = [
      { ...base, member_id: 'nuevo', visitas: 1 },
      { ...base, member_id: 'habitual', visitas: 40 },
    ]
    expect(asistentes(filas).map(x => x.member_id)).toEqual(['habitual'])
  })
})

const base: AsistenteDeLaSemana = {
  member_id: 'x', nombre: 'x', sedes: ['Sede Cartago'],
  telefono: null, email: null, regreso: null, visitas: 10,
}

describe('esAbandono', () => {
  const FIN = '2026-09-20'

  it('no volvió nunca: cortó', () => {
    expect(esAbandono(null, FIN)).toBe(true)
  })

  it('volvió dentro de la espera: no cortó', () => {
    expect(esAbandono('2026-09-06', FIN)).toBe(false)
  })

  it('el último día de la espera todavía cuenta como que volvió', () => {
    expect(esAbandono(FIN, FIN)).toBe(false)
  })

  it('volvió después: cortó igual, y eso es lo que la lista quiere decir', () => {
    expect(esAbandono('2026-10-04', FIN)).toBe(true)
  })
})

describe('abandonos', () => {
  const p = (n: Partial<AsistenteDeLaSemana> & { nombre: string }) =>
    ({ ...base, member_id: n.nombre, ...n })
  const FIN = '2026-09-20'

  it('deja fuera a quien volvió dentro de la espera', () => {
    const r = abandonos([p({ nombre: 'Ana', regreso: '2026-09-06' }), p({ nombre: 'Beto' })], FIN)
    expect(r.map(x => x.nombre)).toEqual(['Beto'])
  })

  it('deja fuera al que vino UNA sola vez: es visitante, no abandono', () => {
    const r = abandonos([p({ nombre: 'Visita', visitas: 1 }), p({ nombre: 'Beto' })], FIN)
    expect(r.map(x => x.nombre)).toEqual(['Beto'])
  })

  it('primero los que no han vuelto: son los que hay que llamar', () => {
    const r = abandonos([
      p({ nombre: 'Ana', regreso: '2026-10-02' }),
      p({ nombre: 'Zulema' }),
      p({ nombre: 'Beto' }),
    ], FIN)
    expect(r.map(x => x.nombre)).toEqual(['Beto', 'Zulema', 'Ana'])
    expect(r[2].volvioEl).toBe('2026-10-02')
  })

  it('sin nadie devuelve vacío, no null', () => {
    expect(abandonos([], FIN)).toEqual([])
  })
})

describe('sedeDeLaSemana', () => {
  it('si asistió a dos sedes se muestran las dos', () => {
    expect(sedeDeLaSemana(['Sede Madrid', 'Sede Cartago'])).toBe('Sede Cartago, Sede Madrid')
  })
  it('no repite la sede cuando fue dos veces al mismo lugar', () => {
    expect(sedeDeLaSemana(['Sede Cartago', 'Sede Cartago'])).toBe('Sede Cartago')
  })
  it('sin sedes queda vacío', () => {
    expect(sedeDeLaSemana([])).toBe('')
  })
})

describe('los textos de ayuda', () => {
  it('salen de las constantes y no de un número escrito a mano', () => {
    expect(INFO_ASISTIERON).toContain(`al menos ${VISITAS_MINIMAS} veces`)
    expect(INFO_DEJARON).toContain(`hace ${SEMANAS_DE_CORTE} semanas`)
  })
})
