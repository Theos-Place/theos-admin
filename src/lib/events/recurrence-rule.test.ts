import { describe, it, expect } from 'vitest'
import { construirRegla, leerRegla, describirRegla, RECURRENCIA_DEFAULT } from './recurrence-rule'

const r = (o: Partial<typeof RECURRENCIA_DEFAULT>) => ({ ...RECURRENCIA_DEFAULT, ...o })

describe('construirRegla — lo que pidió el usuario', () => {
  it('cada 2 semanas los sábados', () => {
    expect(construirRegla(r({ freq: 'WEEKLY', interval: 2, days: ['SAT'] })))
      .toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=SA')
  })
  it('el primer y tercer sábado del mes', () => {
    expect(construirRegla(r({ freq: 'MONTHLY', monthMode: 'dow', monthPos: ['1', '3'], monthDow: 'SA' })))
      .toBe('FREQ=MONTHLY;BYDAY=1SA,3SA')
  })
  it('cada 3 meses, el último viernes', () => {
    expect(construirRegla(r({ freq: 'MONTHLY', interval: 3, monthMode: 'dow', monthPos: ['-1'], monthDow: 'FR' })))
      .toBe('FREQ=MONTHLY;INTERVAL=3;BYDAY=-1FR')
  })
})

describe('construirRegla — el formato viejo se conserva', () => {
  it('semanal simple sigue siendo el formato propio', () => {
    // Es lo que ya está escrito en la base y lo que entiende el expansor sin
    // pasar por rrule. Cambiarlo por RRULE no aporta y toca datos existentes.
    expect(construirRegla(r({ freq: 'WEEKLY', days: ['MON', 'WED'] }))).toBe('WEEKLY:MON,WED')
  })
  it('los días salen siempre en orden de la semana, no en el que se tocaron', () => {
    expect(construirRegla(r({ freq: 'WEEKLY', days: ['SUN', 'MON'] }))).toBe('WEEKLY:MON,SUN')
  })
  it('sin días elegidos no genera una regla vacía', () => {
    expect(construirRegla(r({ freq: 'WEEKLY', days: [] }))).toBe('WEEKLY:SUN')
  })
  it('un intervalo inválido cuenta como 1', () => {
    expect(construirRegla(r({ freq: 'WEEKLY', interval: 0, days: ['SAT'] }))).toBe('WEEKLY:SAT')
  })
})

describe('leerRegla — ida y vuelta', () => {
  it.each([
    'WEEKLY:MON,WED',
    'FREQ=WEEKLY;INTERVAL=2;BYDAY=SA',
    'FREQ=MONTHLY;BYDAY=1SA,3SA',
    'FREQ=MONTHLY;INTERVAL=3;BYDAY=-1FR',
    'FREQ=MONTHLY;BYMONTHDAY=15',
  ])('%s se lee y se vuelve a escribir igual', regla => {
    expect(construirRegla(leerRegla(regla)!)).toBe(regla)
  })
  it('acepta el prefijo RRULE:', () => {
    expect(leerRegla('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SA')?.interval).toBe(2)
  })
  it('lo que no se reconoce devuelve null, no un default silencioso', () => {
    expect(leerRegla('')).toBeNull()
    expect(leerRegla(null)).toBeNull()
    expect(leerRegla('CADA TANTO')).toBeNull()
  })
})

describe('describirRegla', () => {
  it.each([
    [r({ freq: 'WEEKLY', days: ['SAT'] }), 'Todas las semanas los sábado'],
    [r({ freq: 'WEEKLY', interval: 2, days: ['SAT'] }), 'Cada 2 semanas los sábado'],
    [r({ freq: 'WEEKLY', days: ['MON', 'WED', 'FRI'] }), 'Todas las semanas los lunes, miércoles y viernes'],
    [r({ freq: 'MONTHLY', monthMode: 'dow', monthPos: ['1', '3'], monthDow: 'SA' }), 'El primer y tercer sábado de cada mes'],
    [r({ freq: 'MONTHLY', monthMode: 'dom', monthDay: 15 }), 'El día 15 de cada mes'],
    [r({ freq: 'MONTHLY', interval: 2, monthMode: 'dow', monthPos: ['-1'], monthDow: 'FR' }), 'El último viernes cada 2 meses'],
  ])('%#', (rec, texto) => expect(describirRegla(rec)).toBe(texto))
})
