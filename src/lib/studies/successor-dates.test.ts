import { describe, it, expect } from 'vitest'
import { fechasDelSucesor, sumarDias, proximoDiaDeClase } from './successor-dates'

describe('fechasDelSucesor', () => {
  it('el caso real: cierre el miércoles 2, grupo de miércoles → arranca el 16', () => {
    // 2 + 8 días = jueves 10; el próximo miércoles es el 16.
    const r = fechasDelSucesor({
      finDelAnterior: '2026-08-10', semanas: 11, hoy: '2026-09-02', diasDeClase: ['X'],
    })
    expect(r.starts_at).toBe('2026-09-16')
  })

  it('sin días configurados arranca exactamente a los 8 días', () => {
    expect(fechasDelSucesor({ finDelAnterior: null, semanas: 10, hoy: '2026-09-02' }).starts_at)
      .toBe('2026-09-10')
    expect(fechasDelSucesor({ finDelAnterior: null, semanas: 10, hoy: '2026-09-02', diasDeClase: [] }).starts_at)
      .toBe('2026-09-10')
  })

  it('si el día 8 YA es día de clase, arranca ese mismo día', () => {
    // 2026-09-02 es miércoles; +8 = jueves 10.
    expect(fechasDelSucesor({
      finDelAnterior: null, semanas: 10, hoy: '2026-09-02', diasDeClase: ['J'],
    }).starts_at).toBe('2026-09-10')
  })

  it('con varios días toma el primero que llegue', () => {
    // +8 = jueves 10. Con lunes y viernes, el más cercano es el viernes 11.
    expect(fechasDelSucesor({
      finDelAnterior: null, semanas: 10, hoy: '2026-09-02', diasDeClase: ['L', 'V'],
    }).starts_at).toBe('2026-09-11')
  })

  it('no se le monta al grupo anterior si ese todavía no ha terminado', () => {
    // Cierre anticipado: +8 daría el 10, pero el anterior corre hasta el 30.
    const r = fechasDelSucesor({
      finDelAnterior: '2026-09-30', semanas: 10, hoy: '2026-09-02', diasDeClase: ['X'],
    })
    expect(r.starts_at).toBe('2026-09-30') // miércoles
  })

  it('el fin se cuenta desde el arranque real, con la semana de vacaciones', () => {
    const r = fechasDelSucesor({
      finDelAnterior: null, semanas: 10, hoy: '2026-09-02', diasDeClase: ['J'],
    })
    // arranca 2026-09-10 + (10 + 1) semanas
    expect(r.starts_at).toBe('2026-09-10')
    expect(r.ends_at).toBe('2026-11-26')
  })

  it('el período incluye SIEMPRE la semana de vacaciones', () => {
    const { starts_at, ends_at } = fechasDelSucesor({
      finDelAnterior: null, semanas: 10, hoy: '2026-01-01',
    })
    expect(starts_at).toBe('2026-01-09')                      // el cierre + 8
    expect(sumarDias(starts_at, 10 * 7)).toBe('2026-03-20')   // sin vacaciones
    expect(ends_at).toBe('2026-03-27')                        // con la semana
  })

  it('acepta un timestamp completo en el fin del anterior', () => {
    expect(fechasDelSucesor({
      finDelAnterior: '2026-09-30T00:00:00Z', semanas: 9, hoy: '2026-09-02', diasDeClase: ['X'],
    }).starts_at).toBe('2026-09-30')
  })

  it('sin duración NO se inventa un fin', () => {
    // Un fin falso dispararía el recordatorio de cierre en una fecha que nadie
    // acordó. Mejor sin fin que con uno inventado.
    for (const semanas of [null, undefined, 0, -3, NaN]) {
      expect(fechasDelSucesor({ finDelAnterior: '2026-08-10', semanas, hoy: '2026-09-02' }).ends_at).toBeNull()
    }
  })

  it('nunca arranca en el pasado, aunque el anterior haya terminado hace meses', () => {
    const r = fechasDelSucesor({
      finDelAnterior: '2026-08-10', semanas: 10, hoy: '2026-09-02', diasDeClase: ['X'],
    })
    expect(r.starts_at > '2026-09-02').toBe(true)
  })

  it('sumarDias no se corre de día por la zona horaria', () => {
    // Costa Rica es UTC-6 y Vercel corre en UTC: hacer la cuenta en local
    // movería la fecha un día.
    expect(sumarDias('2026-08-10', 63)).toBe('2026-10-12')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('proximoDiaDeClase', () => {
  it('2026-09-10 es jueves: pedir miércoles da el 16', () => {
    expect(proximoDiaDeClase('2026-09-10', ['X'])).toBe('2026-09-16')
  })

  it('pedir el mismo día que ya es, lo devuelve sin moverlo', () => {
    expect(proximoDiaDeClase('2026-09-10', ['J'])).toBe('2026-09-10')
  })

  it('cubre los siete días de la semana', () => {
    // 2026-09-10 es jueves.
    expect(proximoDiaDeClase('2026-09-10', ['V'])).toBe('2026-09-11')
    expect(proximoDiaDeClase('2026-09-10', ['S'])).toBe('2026-09-12')
    expect(proximoDiaDeClase('2026-09-10', ['D'])).toBe('2026-09-13')
    expect(proximoDiaDeClase('2026-09-10', ['L'])).toBe('2026-09-14')
    expect(proximoDiaDeClase('2026-09-10', ['M'])).toBe('2026-09-15')
    expect(proximoDiaDeClase('2026-09-10', ['X'])).toBe('2026-09-16')
  })

  it('sin días no mueve la fecha: no se inventa un horario', () => {
    expect(proximoDiaDeClase('2026-09-10', null)).toBe('2026-09-10')
    expect(proximoDiaDeClase('2026-09-10', [])).toBe('2026-09-10')
  })

  it('un código basura se ignora y no rompe', () => {
    expect(proximoDiaDeClase('2026-09-10', ['Z'])).toBe('2026-09-10')
    expect(proximoDiaDeClase('2026-09-10', ['Z', 'V'])).toBe('2026-09-11')
  })

  it('cruza el fin de mes sin perderse', () => {
    // 2026-09-30 es miércoles; el próximo jueves es el 1 de octubre.
    expect(proximoDiaDeClase('2026-09-30', ['J'])).toBe('2026-10-01')
  })
})
