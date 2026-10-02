import { describe, it, expect } from 'vitest'
import {
  motivoParaRechazarArreglo, ultimoVencimiento, limiteDeEstudio, opcionesPermitidas,
  MAX_TRACTOS_EVENTO,
} from '@/lib/finance/limites-de-arreglo'
import { planInstallments, MAX_INSTALLMENTS } from '@/lib/finance/installments'

/** Arma la propuesta como la arma el servidor, con los vencimientos reales. */
const propuesta = (installments: number, frequency: 'mensual' | 'quincenal', firstDue: string) => ({
  installments, frequency,
  vencimientos: planInstallments({ total: 20000, count: installments, firstDue, frequency })
    .map(t => t.due_date),
})

const evento = (limite: string | null) =>
  ({ tipo: 'evento' as const, limite, origenDelLimite: 'inicio_actividad' as const })
const estudio = (limite: string | null) =>
  ({ tipo: 'estudio' as const, limite, origenDelLimite: 'cierre_matricula' as const })

describe('FIN-13 · arreglos de ACTIVIDADES', () => {
  it('tres tractos se rechazan: el máximo son dos', () => {
    const m = motivoParaRechazarArreglo(propuesta(3, 'quincenal', '2026-10-05'), evento('2026-12-01'))
    expect(m?.code).toBe('DEMASIADOS_TRACTOS')
    expect(m?.error).toContain('2 tractos')
  })

  it('dos tractos se aceptan', () => {
    expect(motivoParaRechazarArreglo(propuesta(2, 'quincenal', '2026-10-05'), evento('2026-12-01')))
      .toBeNull()
  })

  it('mensual se rechaza aunque sean dos tractos', () => {
    // No hay tiempo para cuotas mensuales: las actividades se anuncian con
    // cerca de un mes de anticipación.
    const m = motivoParaRechazarArreglo(propuesta(2, 'mensual', '2026-10-05'), evento('2026-12-01'))
    expect(m?.code).toBe('FRECUENCIA_NO_PERMITIDA')
  })

  it('un vencimiento DESPUÉS de la actividad se rechaza', () => {
    // Cobrar después del evento no es un arreglo de pago, es una deuda.
    const m = motivoParaRechazarArreglo(propuesta(2, 'quincenal', '2026-10-05'), evento('2026-10-10'))
    expect(m?.code).toBe('VENCE_DESPUES_DE_LA_ACTIVIDAD')
    expect(m?.error).toContain('10/10/2026')
  })

  it('y vencer EL MISMO DÍA de la actividad también: la plata entraría ese día', () => {
    const p = { installments: 2, frequency: 'quincenal' as const,
                vencimientos: ['2026-10-05', '2026-10-15'] }
    expect(motivoParaRechazarArreglo(p, evento('2026-10-15'))?.code)
      .toBe('VENCE_DESPUES_DE_LA_ACTIVIDAD')
  })

  it('el error se queja primero de los tractos y no de la fecha', () => {
    // Quien lo lee está llenando un formulario: corregir los tractos cambia
    // los vencimientos, así que pedir las dos cosas a la vez confunde.
    const m = motivoParaRechazarArreglo(propuesta(5, 'quincenal', '2026-10-05'), evento('2026-10-06'))
    expect(m?.code).toBe('DEMASIADOS_TRACTOS')
  })
})

describe('FIN-13 · arreglos de ESTUDIOS', () => {
  it('se cierran dentro de la matrícula, no mientras dure el estudio', () => {
    const m = motivoParaRechazarArreglo(propuesta(3, 'mensual', '2026-10-05'), estudio('2026-11-01'))
    expect(m?.code).toBe('VENCE_DESPUES_DE_LA_MATRICULA')
    expect(m?.error).toContain('matrícula')
  })

  it('dentro de la ventana se aceptan, y sin obligar quincena', () => {
    expect(motivoParaRechazarArreglo(propuesta(2, 'mensual', '2026-10-05'), estudio('2026-12-01')))
      .toBeNull()
  })

  it('a un estudio NO se le topan los tractos en dos', () => {
    // El tope lo pone la fecha, que ya es corta. Tres tractos que caben
    // dentro de la matrícula son válidos.
    expect(motivoParaRechazarArreglo(propuesta(3, 'quincenal', '2026-10-01'), estudio('2026-12-01')))
      .toBeNull()
  })
})

describe('FIN-13 · la fecha tope de un estudio', () => {
  it('es el cierre de matrícula cuando existe', () => {
    expect(limiteDeEstudio({ enrollment_end_date: '2026-10-20', starts_at: '2026-10-27' }))
      .toEqual({ limite: '2026-10-20', origenDelLimite: 'cierre_matricula' })
  })

  it('y el inicio del estudio cuando no', () => {
    // Medido en producción: de 2 209 grupos solo 40 tienen cierre de
    // matrícula. Los 12 abiertos sí lo tienen, pero el resto necesita un
    // respaldo real en vez de quedar sin regla.
    expect(limiteDeEstudio({ enrollment_end_date: null, starts_at: '2026-10-27' }))
      .toEqual({ limite: '2026-10-27', origenDelLimite: 'inicio_estudio' })
  })

  it('sin ninguna de las dos no se inventa una fecha', () => {
    // 60 grupos están así. Inventar un tope sería peor que no tener la regla.
    expect(limiteDeEstudio({ enrollment_end_date: null, starts_at: null }))
      .toEqual({ limite: null, origenDelLimite: null })
  })

  it('y sin tope la regla no bloquea', () => {
    expect(motivoParaRechazarArreglo(propuesta(4, 'mensual', '2026-10-05'), estudio(null)))
      .toBeNull()
  })
})

describe('FIN-13 · lo que la pantalla puede ofrecer', () => {
  it('una actividad ofrece solo quincenal y hasta dos tractos', () => {
    // Mostrar «hasta 24 tractos» y reventar al guardar es la peor combinación.
    expect(opcionesPermitidas('evento', MAX_INSTALLMENTS))
      .toEqual({ maxTractos: MAX_TRACTOS_EVENTO, frecuencias: ['quincenal'] })
  })

  it('un estudio mantiene las dos frecuencias y el tope global', () => {
    expect(opcionesPermitidas('estudio', MAX_INSTALLMENTS))
      .toEqual({ maxTractos: MAX_INSTALLMENTS, frecuencias: ['mensual', 'quincenal'] })
  })
})

describe('FIN-13 · el último vencimiento', () => {
  it('no asume que vengan ordenados', () => {
    expect(ultimoVencimiento(['2026-11-15', '2026-10-30', '2026-12-01'])).toBe('2026-12-01')
  })

  it('ignora lo que no es una fecha', () => {
    expect(ultimoVencimiento(['', 'mañana', '2026-10-30'])).toBe('2026-10-30')
    expect(ultimoVencimiento([])).toBeNull()
  })
})
