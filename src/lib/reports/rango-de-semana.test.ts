import { describe, it, expect } from 'vitest'
import { rangoDeSemana, lunesDeSemanaISO, rangoDesdeClave } from './rango-de-semana'
import { semanaISO } from './semana-detalle'

const ymd = (d: Date) => d.toISOString().slice(0, 10)

describe('rangoDeSemana', () => {
  it('una semana normal no repite el mes', () => {
    // El caso del pedido: "Semana 38" no le dice nada a nadie.
    const r = rangoDeSemana(2026, 38, 2026)
    expect(ymd(r.desde)).toBe('2026-09-14')
    expect(ymd(r.hasta)).toBe('2026-09-20')
    expect(r.etiqueta).toBe('14–20 set')
  })

  it('setiembre se abrevia SET, como en Costa Rica', () => {
    // 'sep' es la abreviatura que devuelve toLocaleDateString; acá no se usa.
    expect(rangoDeSemana(2026, 38, 2026).etiqueta).toContain('set')
    expect(rangoDeSemana(2026, 38, 2026).etiqueta).not.toContain('sep')
  })

  it('cuando cruza de mes, aparecen los dos', () => {
    const r = rangoDeSemana(2026, 40, 2026)
    expect(ymd(r.desde)).toBe('2026-09-28')
    expect(ymd(r.hasta)).toBe('2026-10-04')
    expect(r.etiqueta).toBe('28 set–4 oct')
  })

  it('la semana 26 de 2026 es el 22–28 de junio', () => {
    // El dato concreto que se quería averiguar y que hoy hay que calcular a mano.
    expect(rangoDeSemana(2026, 26, 2026).etiqueta).toBe('22–28 jun')
  })

  it('LA SEMANA 1 PUEDE ARRANCAR EN DICIEMBRE del año anterior', () => {
    // Definición ISO: la semana 1 es la que contiene el primer jueves de enero.
    // Acá el año SÍ tiene que salir, o la etiqueta miente.
    const r = rangoDeSemana(2026, 1, 2026)
    expect(ymd(r.desde)).toBe('2025-12-29')
    expect(ymd(r.hasta)).toBe('2026-01-04')
    expect(r.etiqueta).toBe('29 dic 2025–4 ene 2026')
  })

  it('la última semana puede terminar en enero del siguiente', () => {
    const r = rangoDeSemana(2026, 53, 2026)
    expect(ymd(r.desde)).toBe('2026-12-28')
    expect(ymd(r.hasta)).toBe('2027-01-03')
    expect(r.etiqueta).toContain('2027')
  })

  it('2026 tiene 53 semanas y 2025 no', () => {
    // Un año ISO tiene 53 semanas cuando empieza en jueves (o miércoles bisiesto).
    expect(ymd(lunesDeSemanaISO(2026, 53))).toBe('2026-12-28')
    // La "semana 53" de 2025 no existe: cae ya dentro de 2026.
    expect(semanaISO(lunesDeSemanaISO(2025, 53))).toEqual({ year: 2026, week: 1 })
  })

  it('sin año de referencia, nunca muestra el año', () => {
    expect(rangoDeSemana(2026, 38).etiqueta).toBe('14–20 set')
  })

  it('la etiqueta corta es solo el lunes, para los ticks del eje', () => {
    expect(rangoDeSemana(2026, 38, 2026).etiquetaCorta).toBe('14 set')
    expect(rangoDeSemana(2026, 40, 2026).etiquetaCorta).toBe('28 set')
  })

  it('el número ISO va DETRÁS, como dato secundario', () => {
    expect(rangoDeSemana(2026, 38, 2026).conNumero).toBe('Semana 38 · 14–20 set')
  })

  it('ida y vuelta con semanaISO: el lunes pertenece a su propia semana', () => {
    for (const [y, w] of [[2026, 1], [2026, 26], [2026, 38], [2026, 53], [2025, 1], [2024, 52]] as const) {
      expect(semanaISO(lunesDeSemanaISO(y, w)), `${y}-W${w}`).toEqual({ year: y, week: w })
    }
  })
})

describe('rangoDesdeClave', () => {
  it('lee la clave que viaja en la URL', () => {
    expect(rangoDesdeClave('2026-W38', 2026)?.etiqueta).toBe('14–20 set')
  })

  it('una clave inventada no rompe la pantalla', () => {
    // La URL la escribe cualquiera.
    for (const mala of ['', null, undefined, 'hola', '2026-W00', '2026-W54', '2026W38']) {
      expect(rangoDesdeClave(mala), String(mala)).toBeNull()
    }
  })
})
