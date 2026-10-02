import { describe, it, expect } from 'vitest'
import { inicioDelDiaCR, finDelDiaCR, rangoDePago } from '@/lib/finance/rango-de-pagos'

describe('PAG-6 · el rango de la conciliación va en hora de Costa Rica', () => {
  it('el día arranca a medianoche CR, que son las 6 a.m. UTC', () => {
    expect(new Date(inicioDelDiaCR('2026-09-01')!).toISOString())
      .toBe('2026-09-01T06:00:00.000Z')
  })

  it('y termina al último milisegundo del día CR', () => {
    expect(new Date(finDelDiaCR('2026-09-30')!).toISOString())
      .toBe('2026-10-01T05:59:59.999Z')
  })

  it('un pago de la noche del lunes en CR cae en el lunes, no en el martes', () => {
    // Caso REAL: en producción hay pagos a las 00:57 UTC. Eso es las 6:57 p.m.
    // del día anterior en Costa Rica. Con un filtro ingenuo contra la fecha
    // pelada, ese pago se le corre a Andrés al día siguiente y los números no
    // le cuadran contra el estado de cuenta.
    const pago = new Date('2026-09-29T00:57:00.000Z') // lunes 28, 6:57 p.m. CR
    const { desdeIso, hastaIso } = rangoDePago('2026-09-28', '2026-09-28')
    expect(pago >= new Date(desdeIso!)).toBe(true)
    expect(pago <= new Date(hastaIso!)).toBe(true)
  })

  it('y NO cae en el día siguiente', () => {
    const pago = new Date('2026-09-29T00:57:00.000Z')
    const { desdeIso, hastaIso } = rangoDePago('2026-09-29', '2026-09-29')
    expect(pago >= new Date(desdeIso!) && pago <= new Date(hastaIso!)).toBe(false)
  })

  it('el pago de las 23:59:59.4 entra: perderlo descuadra el mes', () => {
    const pago = new Date('2026-09-30T23:59:59.400-06:00')
    const { hastaIso } = rangoDePago('2026-09-01', '2026-09-30')
    expect(pago <= new Date(hastaIso!)).toBe(true)
  })

  it('«del 30 al 1» se entiende al revés en vez de devolver vacío', () => {
    // Una lista vacía se lee como «no hubo pagos», que es una respuesta falsa.
    const alReves = rangoDePago('2026-09-30', '2026-09-01')
    const bien = rangoDePago('2026-09-01', '2026-09-30')
    expect(alReves).toEqual(bien)
  })

  it('lo que no es una fecha no filtra nada', () => {
    expect(rangoDePago('', null)).toEqual({ desdeIso: null, hastaIso: null })
    expect(rangoDePago('ayer', '2026-13-45')).toEqual({ desdeIso: null, hastaIso: null })
  })

  it('y una fecha que no existe tampoco, aunque tenga la forma correcta', () => {
    // El regex solo deja pasar «2026-13-45», y ese texto llegaría a PostgREST.
    // El 30 de febrero es el caso traicionero: `new Date` lo acomoda solo al
    // 2 de marzo sin avisar.
    expect(rangoDePago('2026-02-30', null).desdeIso).toBeNull()
    expect(rangoDePago('2026-00-10', null).desdeIso).toBeNull()
    // 2026 NO es bisiesto, así que su 29 de febrero tampoco existe; 2024 sí.
    expect(rangoDePago('2026-02-29', null).desdeIso).toBeNull()
    expect(rangoDePago('2024-02-29', null).desdeIso).not.toBeNull()
  })

  it('un solo extremo filtra solo por ese lado', () => {
    const { desdeIso, hastaIso } = rangoDePago('2026-09-01', null)
    expect(desdeIso).not.toBeNull()
    expect(hastaIso).toBeNull()
  })
})
