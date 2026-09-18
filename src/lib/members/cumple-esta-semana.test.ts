import { describe, it, expect } from 'vitest'
import { cumpleEstaSemana, textoDelCumple } from './cumple-esta-semana'

// 2026-09-16 es MIÉRCOLES. Su semana va del lunes 14 al domingo 20.
const MIERCOLES = '2026-09-16'

describe('cumpleEstaSemana', () => {
  it('hoy', () => {
    expect(cumpleEstaSemana('1990-09-16', MIERCOLES)).toEqual({ cuando: 'hoy', fecha: '2026-09-16' })
  })

  it('más adelante en la semana', () => {
    expect(cumpleEstaSemana('1990-09-19', MIERCOLES)).toEqual({ cuando: 'esta_semana', fecha: '2026-09-19' })
  })

  it('YA PASÓ pero es de esta semana: igual se avisa', () => {
    // El lunes sigue siendo esta semana. Felicitar tarde es mejor que no
    // felicitar, y el operador decide qué decir.
    expect(cumpleEstaSemana('1990-09-14', MIERCOLES)).toEqual({ cuando: 'esta_semana', fecha: '2026-09-14' })
  })

  it('los bordes: el lunes entra y el domingo también', () => {
    expect(cumpleEstaSemana('1990-09-14', MIERCOLES)?.fecha).toBe('2026-09-14')
    expect(cumpleEstaSemana('1990-09-20', MIERCOLES)?.fecha).toBe('2026-09-20')
  })

  it('un día antes o un día después de la semana, no', () => {
    expect(cumpleEstaSemana('1990-09-13', MIERCOLES)).toBeNull() // domingo anterior
    expect(cumpleEstaSemana('1990-09-21', MIERCOLES)).toBeNull() // lunes siguiente
  })

  it('EL CASO QUE ROMPE UNA COMPARACIÓN DE TEXTO: la semana que cruza el año', () => {
    // Miércoles 30-dic-2026: la semana va del lunes 28-dic al domingo 3-ene-2027.
    // Comparar "MM-DD entre 12-28 y 01-03" da falso para todo, porque 01-02 es
    // menor que 12-28. Por eso se recorren los días de verdad.
    const finDeAnio = '2026-12-30'
    expect(cumpleEstaSemana('1990-01-02', finDeAnio)).toEqual({ cuando: 'esta_semana', fecha: '2027-01-02' })
    expect(cumpleEstaSemana('1990-12-28', finDeAnio)).toEqual({ cuando: 'esta_semana', fecha: '2026-12-28' })
    expect(cumpleEstaSemana('1990-01-04', finDeAnio)).toBeNull()
  })

  it('y al revés: en enero, la semana que viene de diciembre', () => {
    // Viernes 1-ene-2027: la semana empezó el lunes 28-dic-2026.
    expect(cumpleEstaSemana('1990-12-29', '2027-01-01')).toEqual({ cuando: 'esta_semana', fecha: '2026-12-29' })
  })

  it('29 de febrero: en año NO bisiesto se avisa el 28', () => {
    // 2027 no es bisiesto. Quien nació el 29-feb se festeja el 28 — la misma
    // regla que usa el saludo por correo (birthdayMatchDays), no una copia.
    expect(cumpleEstaSemana('1992-02-29', '2027-02-28')).toEqual({ cuando: 'hoy', fecha: '2027-02-28' })
  })

  it('29 de febrero en año bisiesto: su propio día', () => {
    // 2028 sí es bisiesto: el 29 existe y es martes.
    expect(cumpleEstaSemana('1992-02-29', '2028-02-28')).toEqual({ cuando: 'esta_semana', fecha: '2028-02-29' })
  })

  it('sin fecha de nacimiento, nada — y sin reventar', () => {
    expect(cumpleEstaSemana(null, MIERCOLES)).toBeNull()
    expect(cumpleEstaSemana(undefined, MIERCOLES)).toBeNull()
    expect(cumpleEstaSemana('', MIERCOLES)).toBeNull()
  })

  it('basura de entrada tampoco revienta', () => {
    expect(cumpleEstaSemana('no soy fecha', MIERCOLES)).toBeNull()
    expect(cumpleEstaSemana('1990-09-16', 'tampoco')).toBeNull()
    expect(cumpleEstaSemana('1990-09-16T10:00:00Z', MIERCOLES)).toBeNull()
  })

  it("acepta 'MM-DD' suelto, que es lo que manda el buscador del check-in", () => {
    // Sin el año: el operador necesita el día, no la edad de la persona.
    expect(cumpleEstaSemana('09-16', MIERCOLES)).toEqual({ cuando: 'hoy', fecha: '2026-09-16' })
    expect(cumpleEstaSemana('09-19', MIERCOLES)?.cuando).toBe('esta_semana')
    expect(cumpleEstaSemana('02-29', '2027-02-28')?.cuando).toBe('hoy')
    expect(cumpleEstaSemana('09-13', MIERCOLES)).toBeNull()
  })

  it('el año de nacimiento no influye', () => {
    for (const anio of ['1935', '1990', '2020']) {
      expect(cumpleEstaSemana(`${anio}-09-16`, MIERCOLES)?.cuando, anio).toBe('hoy')
    }
  })
})

describe('textoDelCumple', () => {
  it('hoy se dice distinto: felicitar no es adelantarse', () => {
    expect(textoDelCumple('Ana', { cuando: 'hoy', fecha: '2026-09-16' }))
      .toBe('¡Hoy es el cumpleaños de Ana! Felicitalo 🎂')
  })

  it('otro día de la semana lleva el día de la semana y la fecha', () => {
    const t = textoDelCumple('Ana', { cuando: 'esta_semana', fecha: '2026-09-19' })
    expect(t).toContain('sábado')
    expect(t).toContain('19')
    expect(t).toContain('Ana')
  })

  it('la fecha NO se corre un día', () => {
    // El bug de fecha-cr: armar "2026-09-19" como medianoche UTC y mostrarla en
    // hora CR la retrocede al 18. Acá se arma y se formatea en UTC.
    expect(textoDelCumple('Ana', { cuando: 'esta_semana', fecha: '2026-09-19' })).not.toContain('18')
  })
})
