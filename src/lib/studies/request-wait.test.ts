import { describe, it, expect } from 'vitest'
import {
  ESTADO_EN_ESPERA, SEMANAS_OFRECIDAS, fechaDeReactivacion, motivoQueImpideEsperar,
  solicitudesADespertar, diasParaDespertar, parcheAlDespertar,
} from './request-wait'
import { estaVencida, solicitudesAVencer, fechaDeReferencia } from './request-expiry'

describe('fechaDeReactivacion', () => {
  it('cuenta en semanas desde hoy', () => {
    expect(fechaDeReactivacion('2026-09-25', 2)).toBe('2026-10-09')
    expect(fechaDeReactivacion('2026-09-25', 12)).toBe('2026-12-18')
  })

  it('cruza el fin de año sin perderse', () => {
    expect(fechaDeReactivacion('2026-12-28', 2)).toBe('2027-01-11')
  })

  it('una fecha basura revienta en vez de guardar cualquier cosa', () => {
    expect(() => fechaDeReactivacion('25/09/2026', 4)).toThrow()
  })
})

describe('quién puede ponerse en espera', () => {
  const ok = { requestType: 'relocation', status: 'open', semanas: 8 }

  it('una reubicación abierta o en revisión, sí', () => {
    expect(motivoQueImpideEsperar(ok)).toBeNull()
    expect(motivoQueImpideEsperar({ ...ok, status: 'in_review' })).toBeNull()
  })

  it('una solicitud de interés, no: es un dato de demanda que no se gestiona', () => {
    expect(motivoQueImpideEsperar({ ...ok, requestType: 'study_interest' }))
      .toMatch(/reubicación/)
  })

  it('una resuelta o rechazada, no: ya se cerraron', () => {
    for (const status of ['resolved', 'rejected', 'vencida']) {
      expect(motivoQueImpideEsperar({ ...ok, status }), status).toBeTruthy()
    }
  })

  it('una que ya está durmiendo, no: primero se despierta', () => {
    expect(motivoQueImpideEsperar({ ...ok, status: ESTADO_EN_ESPERA }))
      .toMatch(/despertala primero/)
  })

  it('las semanas tienen que ser un entero razonable', () => {
    for (const semanas of [0, -4, 99, 2.5, NaN]) {
      expect(motivoQueImpideEsperar({ ...ok, semanas }), String(semanas)).toBeTruthy()
    }
    for (const semanas of SEMANAS_OFRECIDAS) {
      expect(motivoQueImpideEsperar({ ...ok, semanas }), String(semanas)).toBeNull()
    }
  })
})

describe('a quién despertar', () => {
  const dormida = (id: string, wait_until: string | null) => ({ id, status: ESTADO_EN_ESPERA, wait_until })

  it('despierta a la que le llegó el día', () => {
    expect(solicitudesADespertar([dormida('a', '2026-10-05')], '2026-10-05')).toEqual(['a'])
  })

  it('NO despierta antes', () => {
    expect(solicitudesADespertar([dormida('a', '2026-10-05')], '2026-10-04')).toEqual([])
  })

  it('las atrasadas también despiertan: el cron es semanal', () => {
    // Fecha de un miércoles, cron del lunes siguiente. Con igualdad exacta esta
    // solicitud dormiría para siempre.
    expect(solicitudesADespertar([dormida('a', '2026-10-07')], '2026-10-12')).toEqual(['a'])
    // Y si el cron no corrió en meses, lo atrasado sale igual.
    expect(solicitudesADespertar([dormida('a', '2026-01-01')], '2026-10-12')).toEqual(['a'])
  })

  it('no toca las que no están durmiendo, ni las que no tienen fecha', () => {
    expect(solicitudesADespertar([
      { id: 'abierta', status: 'open', wait_until: '2026-01-01' },
      dormida('sin-fecha', null),
    ], '2026-10-12')).toEqual([])
  })
})

describe('diasParaDespertar', () => {
  it('cuenta hacia adelante y hacia atrás', () => {
    expect(diasParaDespertar('2026-10-05', '2026-09-25')).toBe(10)
    expect(diasParaDespertar('2026-09-20', '2026-09-25')).toBe(-5)
  })

  it('sin fecha devuelve null en vez de reventar la pantalla', () => {
    expect(diasParaDespertar(null, '2026-09-25')).toBeNull()
    expect(diasParaDespertar('mañana', '2026-09-25')).toBeNull()
  })
})

/**
 * LA TRAMPA DE REU-2, y la razón por la que existe `reactivated_at`.
 *
 * Una solicitud abierta VENCE cuando cierra el bloque de matrícula que le
 * tocaba, y ese bloque se calcula desde su fecha. Una que durmió cuatro meses
 * a propósito despertaría 'Abierta' con fecha vieja, y el cron de vencimiento
 * la mataría en su siguiente corrida — justo la que alguien decidió conservar.
 */
describe('una solicitud que durmió no es una solicitud vieja', () => {
  const BLOQUES = [
    { id: 'b2', nombre: 'Bloque 2', fecha_cierre_matricula: '2026-05-22T00:00:00Z' },
    { id: 'b3', nombre: 'Bloque 3', fecha_cierre_matricula: '2026-09-13T00:00:00Z' },
    { id: 'b4', nombre: 'Bloque 4', fecha_cierre_matricula: '2027-01-22T00:00:00Z' },
  ]
  // Creada para el Bloque 3, que ya cerró.
  const vieja = { id: 's1', status: 'open', created_at: '2026-06-01T00:00:00Z' }
  const HOY = new Date('2026-09-25T12:00:00Z')

  it('sin haber dormido, vence: su bloque ya cerró', () => {
    expect(estaVencida(vieja, BLOQUES, HOY)).toBe(true)
  })

  it('si despertó, NO vence: cuenta desde que volvió', () => {
    const despierta = { ...vieja, reactivated_at: '2026-09-20T00:00:00Z' }
    expect(estaVencida(despierta, BLOQUES, HOY)).toBe(false)
    expect(solicitudesAVencer([despierta], BLOQUES, HOY)).toEqual([])
  })

  it('el parche de despertar es el que trae esa fecha, y apaga el despertador', () => {
    const p = parcheAlDespertar('2026-09-20T00:00:00Z')
    expect(p.reactivated_at).toBe('2026-09-20T00:00:00Z')
    expect(p.wait_until).toBeNull()
    // El parche alcanza por sí solo para salvarla.
    expect(estaVencida({ ...vieja, ...(p as { reactivated_at: string }) }, BLOQUES, HOY)).toBe(false)
  })

  it('una fecha de vuelta basura no gana: se cae a created_at', () => {
    expect(fechaDeReferencia({ created_at: '2026-06-01T00:00:00Z', reactivated_at: 'ayer' }))
      .toBe('2026-06-01T00:00:00Z')
    expect(fechaDeReferencia({ created_at: '2026-06-01T00:00:00Z', reactivated_at: null }))
      .toBe('2026-06-01T00:00:00Z')
  })

  it('y una dormida no vence mientras duerme, aunque su bloque haya cerrado', () => {
    expect(estaVencida({ ...vieja, status: ESTADO_EN_ESPERA }, BLOQUES, HOY)).toBe(false)
  })
})
