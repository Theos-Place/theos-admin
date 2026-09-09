import { describe, it, expect } from 'vitest'
import {
  mostrarInscripciones, esInscripcionHistorica, tasaDeAsistencia,
  textoDeAsistencia, inscritosParaExport, puedeApagarInscripcion,
} from './inscripcion-visible'

const charla = { requires_registration: false, inscritos: 0 }
const conInscripcion = { requires_registration: true, inscritos: 60 }
/** Tuvo inscripciones y después le apagaron la bandera. */
const apagadoConDatos = { requires_registration: false, inscritos: 12 }

describe('¿se muestra la pestaña de inscripciones?', () => {
  it('una charla sin inscripción: NO', () => {
    expect(mostrarInscripciones(charla)).toBe(false)
  })

  it('un evento con inscripción: sí, aunque todavía no haya nadie', () => {
    expect(mostrarInscripciones({ requires_registration: true, inscritos: 0 })).toBe(true)
  })

  it('bandera apagada pero CON inscripciones: sí — no se esconden datos reales', () => {
    expect(mostrarInscripciones(apagadoConDatos)).toBe(true)
  })

  it('y en ese caso, con aviso', () => {
    expect(esInscripcionHistorica(apagadoConDatos)).toBe(true)
    expect(esInscripcionHistorica(charla)).toBe(false)
    expect(esInscripcionHistorica(conInscripcion)).toBe(false)
  })
})

describe('tasa de asistencia', () => {
  it('con inscripción se calcula igual que siempre', () => {
    expect(tasaDeAsistencia({ ...conInscripcion, asistentes: 45 })).toBe(75)
  })

  it('sin inscripción NO aplica: null, no 0', () => {
    // Con 0 la pantalla dibujaba un anillo vacío al 0% en una charla llena.
    expect(tasaDeAsistencia({ ...charla, asistentes: 187 })).toBeNull()
  })

  it('con inscripción pero cero inscritos tampoco: no se divide por cero', () => {
    expect(tasaDeAsistencia({ requires_registration: true, inscritos: 0, asistentes: 5 })).toBeNull()
  })

  it('la bandera apagada con datos viejos tampoco calcula tasa', () => {
    expect(tasaDeAsistencia({ ...apagadoConDatos, asistentes: 10 })).toBeNull()
  })
})

describe('qué se lee bajo el número', () => {
  it('la charla: solo la cantidad, sin denominador', () => {
    expect(textoDeAsistencia({ ...charla, asistentes: 187 })).toBe('187 asistentes')
  })

  it('una sola persona no dice "1 asistentes"', () => {
    expect(textoDeAsistencia({ ...charla, asistentes: 1 })).toBe('1 asistente')
  })

  it('con inscripción, la frase de siempre', () => {
    expect(textoDeAsistencia({ ...conInscripcion, asistentes: 45 }))
      .toBe('45 de 60 inscritos asistieron')
  })

  it('una charla NUNCA dice "de 0 inscritos", que era el bug', () => {
    // 187 de 0 inscritos: el 0 no era un dato, era una división que no se debió
    // hacer. Vale también para el evento al que le apagaron la bandera.
    for (const e of [charla, apagadoConDatos]) {
      expect(textoDeAsistencia({ ...e, asistentes: 187 })).not.toMatch(/inscritos/)
    }
  })

  it('un evento CON inscripción y nadie anotado sí se mide contra inscritos', () => {
    // Ahí "0 de 0" es una frase cierta: el evento pedía inscripción y no se
    // anotó nadie. Lo que no aparece es un porcentaje sobre cero.
    expect(textoDeAsistencia({ requires_registration: true, inscritos: 0, asistentes: 0 }))
      .toBe('0 de 0 inscritos asistieron')
    expect(tasaDeAsistencia({ requires_registration: true, inscritos: 0, asistentes: 0 })).toBeNull()
  })

  it('no dice "1 inscritos"', () => {
    expect(textoDeAsistencia({ requires_registration: true, inscritos: 1, asistentes: 1 }))
      .toBe('1 de 1 inscrito asistieron')
  })
})

describe('la columna de un export', () => {
  it('N/A y no "0" cuando el evento no pide inscripción', () => {
    // Un 0 en una hoja de cálculo se lee como dato y se suma en los totales.
    expect(inscritosParaExport(charla)).toBe('N/A')
  })

  it('el número real cuando sí las hay', () => {
    expect(inscritosParaExport(conInscripcion)).toBe('60')
    expect(inscritosParaExport(apagadoConDatos)).toBe('12')
  })

  it('un evento con inscripción y nadie anotado sí dice 0: ahí el 0 es cierto', () => {
    expect(inscritosParaExport({ requires_registration: true, inscritos: 0 })).toBe('0')
  })
})

describe('apagar la bandera de inscripción', () => {
  it('sin inscritos se puede', () => {
    expect(puedeApagarInscripcion(0)).toEqual({ puede: true })
  })

  it('con inscritos NO, y el motivo dice cuántos son', () => {
    const r = puedeApagarInscripcion(12)
    expect(r.puede).toBe(false)
    expect(r.puede === false && r.motivo).toMatch(/12 personas inscritas/)
  })

  it('el mensaje no dice "1 personas"', () => {
    const r = puedeApagarInscripcion(1)
    expect(r.puede === false && r.motivo).toMatch(/1 persona inscrita/)
  })

  it('el motivo explica QUÉ hacer, no solo que no se puede', () => {
    const r = puedeApagarInscripcion(3)
    expect(r.puede === false && r.motivo).toMatch(/primero hay que resolver/)
  })
})
