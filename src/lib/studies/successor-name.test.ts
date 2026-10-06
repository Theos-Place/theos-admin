import { describe, it, expect } from 'vitest'
import { nombreDelSucesor, etiquetaNivel, conElMesDelInicio } from './successor-name'

describe('nombreDelSucesor', () => {
  it('el caso real: reemplaza la etiqueta escrita, no antepone el código', () => {
    // Antes daba "N4 · Nivel 3. Floriana Fonseca. Junio 2026", que se lee
    // como si el grupo fuera de nivel 3 y de nivel 4 a la vez.
    expect(nombreDelSucesor({
      nombreOrigen: 'Nivel 3. Floriana Fonseca. Junio 2026',
      codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('Nivel 4. Floriana Fonseca. Junio 2026')
  })

  it('funciona en la cadena de discípulos', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'Discípulos 1. Ma. Fernanda Salazar. Junio 2026',
      codigoOrigen: 'DIS1', codigoDestino: 'DIS2',
    })).toBe('Discípulos 2. Ma. Fernanda Salazar. Junio 2026')
  })

  it('conserva lo que viene después del nivel', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'Nivel 2 Virtual. Andrea Chaves C. Junio 2026',
      codigoOrigen: 'N2', codigoDestino: 'N3',
    })).toBe('Nivel 3 Virtual. Andrea Chaves C. Junio 2026')
  })

  it('no le importan las mayúsculas', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'NIVEL 3. Fulano', codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('Nivel 4. Fulano')
  })

  it('si el nombre usa el código suelto, lo cambia', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'N3 — Este SJ', codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('N4 — Este SJ')
  })

  it('el código se busca como palabra entera: no rompe "N30"', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'Grupo N30 especial', codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('Nivel 4. Grupo N30 especial')
  })

  it('sin nivel reconocible, antepone la etiqueta nueva', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'Grupo de los martes', codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('Nivel 4. Grupo de los martes')
  })

  it('solo reemplaza la PRIMERA aparición', () => {
    expect(nombreDelSucesor({
      nombreOrigen: 'Nivel 3. Repaso de Nivel 3', codigoOrigen: 'N3', codigoDestino: 'N4',
    })).toBe('Nivel 4. Repaso de Nivel 3')
  })

  it('sin nombre de origen devuelve solo la etiqueta', () => {
    expect(nombreDelSucesor({ nombreOrigen: null, codigoOrigen: 'N3', codigoDestino: 'N4' }))
      .toBe('Nivel 4')
    expect(nombreDelSucesor({ nombreOrigen: '   ', codigoOrigen: 'N3', codigoDestino: 'N4' }))
      .toBe('Nivel 4')
  })
})

describe('etiquetaNivel', () => {
  it('traduce los códigos de las dos cadenas', () => {
    expect(etiquetaNivel('N1')).toBe('Nivel 1')
    expect(etiquetaNivel('N4')).toBe('Nivel 4')
    expect(etiquetaNivel('DIS3')).toBe('Discípulos 3')
    expect(etiquetaNivel('PREMAT')).toBe('Prematrimonial')
  })

  it('un código desconocido se devuelve tal cual', () => {
    expect(etiquetaNivel('HER')).toBe('HER')
    expect(etiquetaNivel(null)).toBe('')
  })
})

describe('el mes del nombre sigue al arranque REAL', () => {
  it('el caso reportado: un N4 que empieza en octubre no dice Julio', () => {
    /**
     * El sucesor heredaba el nombre del origen cambiándole solo el nivel, así
     * que «Nivel 3. Michelle Guier. Julio 2026» daba un grupo de Nivel 4 que
     * arranca el 11 de octubre y se sigue llamando Julio. El correo de
     * folletos lo repetía tal cual y quien imprime leía «Julio» en octubre.
     */
    expect(nombreDelSucesor({
      nombreOrigen: 'Nivel 3. Michelle Guier. Julio 2026',
      codigoOrigen: 'N3', codigoDestino: 'N4', inicioDestino: '2026-10-11',
    })).toBe('Nivel 4. Michelle Guier. Octubre 2026')
  })

  it('cambia también el AÑO cuando el grupo cruza diciembre', () => {
    expect(conElMesDelInicio('Nivel 2. Ana. Diciembre 2026', '2027-01-12'))
      .toBe('Nivel 2. Ana. Enero 2027')
  })

  it('respeta lo que viene después del mes', () => {
    expect(conElMesDelInicio('Nivel 4. Madrigal. Julio 2026 (Virtual)', '2026-10-18'))
      .toBe('Nivel 4. Madrigal. Octubre 2026 (Virtual)')
  })

  it('lee «septiembre» y escribe «setiembre», que es como se dice acá', () => {
    expect(conElMesDelInicio('Nivel 1. Ana. Septiembre 2026', '2026-09-30'))
      .toBe('Nivel 1. Ana. Setiembre 2026')
    expect(conElMesDelInicio('Nivel 1. Ana. Marzo 2026', '2026-09-30'))
      .toBe('Nivel 1. Ana. Setiembre 2026')
  })

  it('el mes con tilde también se encuentra', () => {
    // «Setiembre» no lleva, pero el reemplazo busca sobre el texto sin tildes
    // y corta por posición sobre el original: si eso se rompe, el nombre sale
    // mutilado en vez de corregido.
    expect(conElMesDelInicio('CDEB. Andrey Mora. Junio 2026', '2026-05-31'))
      .toBe('CDEB. Andrey Mora. Mayo 2026')
  })

  it('a un nombre SIN mes no se le inventa uno', () => {
    // «N1 — Heredia» no trae fecha porque nadie se la puso. Agregarla sería
    // escribir un dato que el dirigente no eligió.
    expect(conElMesDelInicio('N1 — Heredia', '2026-10-18')).toBe('N1 — Heredia')
    expect(nombreDelSucesor({
      nombreOrigen: 'N1 — Heredia', codigoOrigen: 'N1', codigoDestino: 'N2',
      inicioDestino: '2026-10-18',
    // Y el nivel sí se cambia, por el código suelto: «N1 — Heredia» es uno
    // de los pocos grupos que lo usan en el nombre.
    })).toBe('N2 — Heredia')
  })

  it('sin fecha de arranque, el nombre no se toca', () => {
    for (const f of [null, undefined, '', 'mañana']) {
      expect(conElMesDelInicio('Nivel 3. Ana. Julio 2026', f), String(f))
        .toBe('Nivel 3. Ana. Julio 2026')
    }
  })
})
