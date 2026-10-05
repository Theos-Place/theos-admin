import { describe, it, expect } from 'vitest'
import {
  resumenDelMes, mesCR, mesActualCR, nombreDelMes, mesesConSolicitudes,
  sigueEnJuego, cuposEnJuego, type SolicitudParaResumir,
} from '@/lib/servers/resumen-del-mes'

const s = (p: Partial<SolicitudParaResumir> = {}): SolicitudParaResumir => ({
  committee_id: 'c1', comite: 'Comité A', cupos: 2,
  estado: 'lista_para_publicar', solicitada: '2026-10-03T15:00:00.000Z', ...p,
})

describe('SRV-20 · el mes se cuenta en días de Costa Rica', () => {
  it('una solicitud del 31 a las 7 p.m. es del mes que terminó, no del siguiente', () => {
    // 2026-11-01T01:00Z son las 7 p.m. del 31 de octubre en Costa Rica. Sin
    // la conversión, lo pedido a fin de mes se corre al mes equivocado — y el
    // mes ES el período de corte de este flujo.
    expect(mesCR('2026-11-01T01:00:00.000Z')).toBe('2026-10')
  })

  it('y una del 1 a las 8 a.m. sí es del mes nuevo', () => {
    expect(mesCR('2026-11-01T14:00:00.000Z')).toBe('2026-11')
  })

  it('sin fecha no se inventa un mes', () => {
    expect(mesCR(null)).toBe('')
    expect(mesCR('cualquier cosa')).toBe('')
  })

  it('el mes actual también sale en hora CR', () => {
    expect(mesActualCR(new Date('2026-11-01T01:00:00.000Z'))).toBe('2026-10')
  })
})

describe('SRV-20 · el resumen del mes', () => {
  const filas = [
    s({ cupos: 5, estado: 'publicada' }),
    s({ cupos: 3, estado: 'lista_para_publicar' }),
    s({ committee_id: 'c2', comite: 'Comité B', cupos: 10, estado: 'publicada' }),
    s({ committee_id: 'c2', comite: 'Comité B', cupos: 2, estado: 'denegado' }),
    // De otro mes: no cuenta.
    s({ cupos: 100, solicitada: '2026-09-03T15:00:00.000Z' }),
  ]
  const r = resumenDelMes(filas, '2026-10')

  it('solo cuenta lo del mes pedido', () => {
    expect(r.cupos).toBe(20)
    expect(r.solicitudes).toBe(4)
  })

  it('separa CUPOS de SOLICITUDES: no son lo mismo', () => {
    // «3 solicitudes» esconde que son veinte personas; «20 cupos» esconde
    // que vino casi todo de un comité.
    const soloUna = resumenDelMes([s({ cupos: 5 })], '2026-10')
    expect(soloUna.solicitudes).toBe(1)
    expect(soloUna.cupos).toBe(5)
  })

  it('los cupos por estado suman el total', () => {
    expect(r.porEstado.reduce((a, e) => a + e.cupos, 0)).toBe(r.cupos)
  })

  it('y el desglose por comité también', () => {
    expect(r.porComite.reduce((a, c) => a + c.cupos, 0)).toBe(r.cupos)
  })

  it('el comité que más pidió va primero', () => {
    expect(r.porComite[0]).toMatchObject({ comite: 'Comité B', cupos: 12 })
    expect(r.porComite[1]).toMatchObject({ comite: 'Comité A', cupos: 8 })
  })

  it('«en juego» deja fuera lo denegado y lo bajado', () => {
    expect(sigueEnJuego('publicada')).toBe(true)
    expect(sigueEnJuego('lista_para_publicar')).toBe(true)
    expect(sigueEnJuego('denegado')).toBe(false)
    expect(sigueEnJuego('despublicada')).toBe(false)
    expect(cuposEnJuego(r)).toBe(18) // 20 menos los 2 denegados
  })

  it('un mes sin nada da ceros, no revienta', () => {
    const vacio = resumenDelMes(filas, '2026-01')
    expect(vacio).toMatchObject({ cupos: 0, solicitudes: 0, porEstado: [], porComite: [] })
  })
})

describe('SRV-20 · el selector de meses', () => {
  it('ofrece solo los meses que tienen algo, del más nuevo al más viejo', () => {
    // Ofrecer meses vacíos haría que la pantalla se vea rota: «pedí algo en
    // agosto y no aparece», cuando simplemente no se pidió.
    const meses = mesesConSolicitudes([
      s({ solicitada: '2026-08-03T15:00:00.000Z' }),
      s({ solicitada: '2026-10-03T15:00:00.000Z' }),
      s({ solicitada: '2026-10-20T15:00:00.000Z' }),
      s({ solicitada: null }),
    ])
    expect(meses).toEqual(['2026-10', '2026-08'])
  })

  it('el mes se escribe en palabras, con «setiembre»', () => {
    expect(nombreDelMes('2026-10')).toBe('octubre de 2026')
    expect(nombreDelMes('2026-09')).toBe('setiembre de 2026')
    expect(nombreDelMes('basura')).toBe('basura')
  })
})
