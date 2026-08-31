import { describe, it, expect } from 'vitest'
import { fechasDelSucesor, sumarDias } from './successor-dates'

describe('fechasDelSucesor', () => {
  it('arranca donde terminó el anterior', () => {
    // DIS1 de junio termina el 10/08; su DIS2 dura 9 semanas + 1 de vacaciones.
    expect(fechasDelSucesor({ finDelAnterior: '2026-08-10', semanas: 9, hoy: '2026-08-31' }))
      .toEqual({ starts_at: '2026-08-10', ends_at: '2026-10-19' })
  })

  it('la cadena de Niveles, con la duración de cada plan', () => {
    // N2 de junio termina el 17/08; su N3 dura 10 semanas + 1 de vacaciones.
    expect(fechasDelSucesor({ finDelAnterior: '2026-08-17', semanas: 10, hoy: '2026-08-31' }))
      .toEqual({ starts_at: '2026-08-17', ends_at: '2026-11-02' })
  })

  it('el período incluye SIEMPRE la semana de vacaciones', () => {
    // La pausa entre un estudio y el siguiente. Va en el fin del período y no
    // en el inicio del que sigue: así se reparte sola por toda la cadena.
    const { starts_at, ends_at } = fechasDelSucesor({ finDelAnterior: '2026-01-05', semanas: 10, hoy: '2026-01-01' })
    expect(sumarDias(starts_at, 10 * 7)).toBe('2026-03-16')   // sin vacaciones
    expect(ends_at).toBe('2026-03-23')                        // con la semana
  })

  it('acepta un timestamp completo y se queda con el día', () => {
    expect(fechasDelSucesor({ finDelAnterior: '2026-08-10T00:00:00Z', semanas: 9, hoy: '2026-08-31' }).starts_at)
      .toBe('2026-08-10')
  })

  it('sin fecha de fin del anterior, arranca el día del cierre', () => {
    expect(fechasDelSucesor({ finDelAnterior: null, semanas: 10, hoy: '2026-08-31' }))
      .toEqual({ starts_at: '2026-08-31', ends_at: '2026-11-16' })
  })

  it('sin duración NO se inventa un fin', () => {
    // Un fin falso dispararía el recordatorio de cierre en una fecha que nadie
    // acordó. Mejor sin fin que con uno inventado.
    for (const semanas of [null, undefined, 0, -3, NaN]) {
      expect(fechasDelSucesor({ finDelAnterior: '2026-08-10', semanas, hoy: '2026-08-31' }).ends_at).toBeNull()
    }
  })

  it('sumarDias no se corre de día por la zona horaria', () => {
    // Costa Rica es UTC-6 y Vercel corre en UTC: hacer la cuenta en local
    // movería la fecha un día.
    expect(sumarDias('2026-08-10', 63)).toBe('2026-10-12')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
  })
})
