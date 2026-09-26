import { describe, it, expect } from 'vitest'
import {
  isVacancyRequestWindowOpen, ventanaDelMes, proximaVentana,
  diasDelMes, hoyEnCostaRica, costaRicaDayOfMonth, textoDeLaVentana,
  CIERRES_EXTENDIDOS, VENTANA_DIA_INICIAL, VENTANA_DIA_FINAL,
} from './request-window'

/** Mediodía UTC = 6 a.m. en Costa Rica, bien lejos de los bordes del día. */
const dia = (ymd: string) => new Date(`${ymd}T12:00:00Z`)

describe('la ventana es del 25 al 30', () => {
  it('abre el 25 y cierra el 30', () => {
    expect(isVacancyRequestWindowOpen(dia('2026-11-24'))).toBe(false)
    expect(isVacancyRequestWindowOpen(dia('2026-11-25'))).toBe(true)
    expect(isVacancyRequestWindowOpen(dia('2026-11-30'))).toBe(true)
    expect(isVacancyRequestWindowOpen(dia('2026-12-01'))).toBe(false)
  })

  it('el 31 YA NO cuenta — antes sí, y por eso el texto mentía', () => {
    // La regla vieja era «del 25 al último día del mes», así que en enero daba
    // 31 y en febrero 28. El líder no sabía nunca hasta cuándo tenía.
    expect(isVacancyRequestWindowOpen(dia('2027-01-31'))).toBe(false)
    expect(isVacancyRequestWindowOpen(dia('2027-01-30'))).toBe(true)
  })

  it('febrero cierra el 28, porque no hay día 30', () => {
    expect(ventanaDelMes(2027, 2)).toEqual({ abre: '2027-02-25', cierra: '2027-02-28' })
    expect(isVacancyRequestWindowOpen(dia('2027-02-28'))).toBe(true)
    expect(isVacancyRequestWindowOpen(dia('2027-03-01'))).toBe(false)
  })

  it('y el 29 en bisiesto: el último día se calcula, no se escribe', () => {
    expect(diasDelMes(2028, 2)).toBe(29)
    expect(ventanaDelMes(2028, 2).cierra).toBe('2028-02-29')
    expect(isVacancyRequestWindowOpen(dia('2028-02-29'))).toBe(true)
  })
})

describe('la extensión puntual de setiembre 2026', () => {
  it('la ventana de setiembre sigue abierta hasta el 5 de octubre', () => {
    expect(CIERRES_EXTENDIDOS['2026-09']).toBe('2026-10-05')
    expect(isVacancyRequestWindowOpen(dia('2026-09-30'))).toBe(true)
    // Acá se veía cerrada si solo se mirara el mes en curso: el 3 de octubre
    // la ventana abierta es la de SETIEMBRE.
    expect(isVacancyRequestWindowOpen(dia('2026-10-01'))).toBe(true)
    expect(isVacancyRequestWindowOpen(dia('2026-10-05'))).toBe(true)
    expect(isVacancyRequestWindowOpen(dia('2026-10-06'))).toBe(false)
  })

  it('y octubre vuelve a lo normal sin que nadie saque la línea', () => {
    expect(ventanaDelMes(2026, 10)).toEqual({ abre: '2026-10-25', cierra: '2026-10-30' })
    expect(isVacancyRequestWindowOpen(dia('2026-10-24'))).toBe(false)
    expect(isVacancyRequestWindowOpen(dia('2026-10-25'))).toBe(true)
    expect(isVacancyRequestWindowOpen(dia('2026-10-31'))).toBe(false)
  })
})

describe('la zona horaria la pone el sistema, no el dispositivo', () => {
  it('las 23:00 del 24 en Costa Rica son el 25 en UTC, y la ventana sigue cerrada', () => {
    // 2026-11-25T05:00:00Z = 2026-11-24 23:00 en Costa Rica.
    expect(hoyEnCostaRica(new Date('2026-11-25T05:00:00Z'))).toBe('2026-11-24')
    expect(isVacancyRequestWindowOpen(new Date('2026-11-25T05:00:00Z'))).toBe(false)
    // Una hora después ya es 25 allá.
    expect(isVacancyRequestWindowOpen(new Date('2026-11-25T06:00:00Z'))).toBe(true)
  })

  it('costaRicaDayOfMonth sigue funcionando: la importan otras pantallas', () => {
    expect(costaRicaDayOfMonth(dia('2026-11-25'))).toBe(25)
  })
})

describe('cuándo vuelve a abrir', () => {
  it('antes del 25, la próxima es la de este mes', () => {
    expect(proximaVentana(dia('2026-11-10')).abre).toBe('2026-11-25')
  })

  it('pasada la ventana, la del mes siguiente', () => {
    expect(proximaVentana(dia('2026-11-30')).abre).toBe('2026-12-25')
  })

  it('cruza el año sin perderse', () => {
    expect(proximaVentana(dia('2026-12-28')).abre).toBe('2027-01-25')
  })
})

describe('el texto dice la fecha real y no una regla que a veces miente', () => {
  it('abierta: hasta cuándo', () => {
    expect(textoDeLaVentana(dia('2026-09-26'))).toBe('Podés solicitar hasta el 5 de octubre.')
  })

  it('febrero abierta: dice 28, no 30', () => {
    expect(textoDeLaVentana(dia('2027-02-26'))).toContain('28 de febrero')
  })

  it('cerrada: la regla y la fecha de la próxima', () => {
    const t = textoDeLaVentana(dia('2026-11-10'))
    expect(t).toContain(`del ${VENTANA_DIA_INICIAL} al ${VENTANA_DIA_FINAL} de cada mes`)
    expect(t).toContain('25 de noviembre')
  })
})
