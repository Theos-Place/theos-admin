import { describe, it, expect } from 'vitest'
import {
  gravedadDe, ordenarPorGravedad, queHacerCon, avisoDeHuerfanos, type CobroHuerfano,
} from './cobros-huerfanos'
import { formatMoney } from '@/lib/format'

const c = (o: Partial<CobroHuerfano> = {}): CobroHuerfano => ({
  id: 'x', persona: 'Alguien', monto: 5000, currency: 'CRC', status: 'pending',
  concepto: 'matricula', huerfanoDesde: '2026-10-07', tieneCredito: false, ...o,
})

describe('MAT-3 · gravedad de un cobro suelto', () => {
  it('pagado es lo más grave: entró plata y no cuelga de nada', () => {
    expect(gravedadDe(c({ status: 'paid' }))).toBe('pagado')
  })

  it('sin persona, ni siquiera se sabe de quién es', () => {
    // Existe de verdad: un cobro de ₡17.500 del 21-set sin member_id.
    expect(gravedadDe(c({ persona: null, status: 'pending' }))).toBe('sin_dueno')
  })

  it('un cancelado es ruido, no un problema', () => {
    expect(gravedadDe(c({ status: 'cancelado' }))).toBe('anulado')
  })

  it('lo grave va primero, y dentro de eso lo más viejo', () => {
    const lista = [
      c({ id: 'anulado', status: 'cancelado' }),
      c({ id: 'pendiente', status: 'pending' }),
      c({ id: 'pagado-nuevo', status: 'paid', huerfanoDesde: '2026-10-07' }),
      c({ id: 'pagado-viejo', status: 'paid', huerfanoDesde: '2026-09-16' }),
    ]
    expect(ordenarPorGravedad(lista).map(x => x.id))
      .toEqual(['pagado-viejo', 'pagado-nuevo', 'pendiente', 'anulado'])
  })
})

describe('qué hacer con cada uno', () => {
  it('un pagado CON crédito ya está resuelto, y hay que decirlo', () => {
    // Las tres de SCJ: su crédito existe desde el 7-oct. Mostrarlas como
    // «hay que devolver la plata» mandaría a finanzas a pagar dos veces.
    expect(queHacerCon(c({ status: 'paid', tieneCredito: true })))
      .toMatch(/Ya se resolvió/)
  })

  it('un pagado SIN crédito es plata que alguien debe reclamar', () => {
    expect(queHacerCon(c({ status: 'paid', tieneCredito: false })))
      .toMatch(/emitir el crédito o devolverla/)
  })

  it('sin dueño, lo primero es averiguar de quién es', () => {
    expect(queHacerCon(c({ persona: null }))).toMatch(/averiguar de quién es/)
  })
})

describe('el aviso a finanzas', () => {
  it('sin nada que avisar, no suena', () => {
    expect(avisoDeHuerfanos([])).toBeNull()
  })

  it('los anulados NO hacen sonar el aviso', () => {
    // Un aviso que suena por ruido se deja de leer, y entonces no sirve el
    // día que suene por algo real.
    expect(avisoDeHuerfanos([c({ status: 'cancelado' }), c({ status: 'cancelado' })])).toBeNull()
  })

  it('dice cuánta plata hay en juego', () => {
    const a = avisoDeHuerfanos([
      c({ status: 'paid', monto: 15000 }),
      c({ status: 'paid', monto: 5000 }),
    ])!
    // Anclado al formateador del repo y no a un literal: el separador de
    // miles de es-CR ya sorprendió una vez (es un espacio, no un punto).
    expect(a.body).toContain(formatMoney(20000, 'CRC'))
    expect(a.title).toMatch(/2 cobros/)
  })

  it('un pagado que YA tiene crédito NO hace sonar el aviso', () => {
    // Los cuatro casos de octubre tienen su crédito desde el 7-oct. Si
    // contaran, el aviso sonaría todos los días por algo ya resuelto.
    expect(avisoDeHuerfanos([c({ status: 'paid', monto: 5000, tieneCredito: true })])).toBeNull()
  })

  it('pero sí suena si entre los resueltos hay uno sin dueño', () => {
    const a = avisoDeHuerfanos([
      c({ status: 'paid', tieneCredito: true }),
      c({ persona: null, monto: 17500 }),
    ])!
    expect(a.title).toBe('Hay 1 cobro de estudio sin estudio')
  })

  it('el singular se lee bien', () => {
    expect(avisoDeHuerfanos([c()])!.title).toBe('Hay 1 cobro de estudio sin estudio')
  })
})
