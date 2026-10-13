import { describe, it, expect } from 'vitest'
import {
  seMuestraEnPublico, cuposLibres, proporcionLlena, textoDeCupos, textoDeEdad,
  puedeCompartirEnlacePublico,
  type GrupoCandidato,
} from './grupos-publicos'

const HOY = '2026-10-12'
const g = (o: Partial<GrupoCandidato> = {}): GrupoCandidato => ({
  id: 'g1', plan_code: 'N1', status: 'en_matricula', max_students: 10, activos: 3,
  enrollment_start_date: null, enrollment_end_date: null,
  is_virtual: false, has_restriction: false, ...o,
})

describe('EST-20 · qué se publica sin login', () => {
  it('un Nivel 1 en matrícula y con campo, sí', () => {
    expect(seMuestraEnPublico(g(), HOY)).toBe(true)
  })

  it('solo Nivel 1: ningún otro plan', () => {
    for (const code of ['N2', 'DIS1', 'SCJ', null]) {
      expect(seMuestraEnPublico(g({ plan_code: code }), HOY), String(code)).toBe(false)
    }
  })

  it('solo en matrícula: ni en curso ni finalizado', () => {
    for (const st of ['en_curso', 'finalizado', null]) {
      expect(seMuestraEnPublico(g({ status: st }), HOY), String(st)).toBe(false)
    }
  })

  it('un grupo LLENO no se publica', () => {
    // El pedido lo dice: si la pública muestra un grupo lleno, es bug.
    expect(seMuestraEnPublico(g({ max_students: 10, activos: 10 }), HOY)).toBe(false)
    expect(seMuestraEnPublico(g({ max_students: 10, activos: 12 }), HOY)).toBe(false)
  })

  it('fuera de la ventana de matrícula, no', () => {
    expect(seMuestraEnPublico(g({ enrollment_start_date: '2026-10-13' }), HOY)).toBe(false)
    expect(seMuestraEnPublico(g({ enrollment_end_date: '2026-10-11' }), HOY)).toBe(false)
  })

  it('el último día de la ventana TODAVÍA cuenta', () => {
    expect(seMuestraEnPublico(g({ enrollment_end_date: HOY }), HOY)).toBe(true)
  })

  it('los VIRTUALES no se publican', () => {
    // Adentro se ocultan salvo autorización del miembro. Sin sesión no hay
    // autorización posible, así que publicarlos ofrecería algo que esa
    // persona no va a poder tomar.
    expect(seMuestraEnPublico(g({ is_virtual: true }), HOY)).toBe(false)
  })

  it('los RESTRINGIDOS tampoco', () => {
    // Su audiencia se decide con el historial de quien mira, y sin sesión no
    // hay historial.
    expect(seMuestraEnPublico(g({ has_restriction: true }), HOY)).toBe(false)
  })

  it('pero el rango de EDAD no esconde el grupo', () => {
    // Único criterio de la interna que acá se deja pasar, a propósito: casi
    // todos los grupos tienen rango y esconderlos dejaría la página vacía.
    // El rango se muestra, que es información pública y útil.
    expect(seMuestraEnPublico(g(), HOY)).toBe(true)
    expect(textoDeEdad({ age_min: 18, age_max: 30 })).toBe('De 18 a 30 años')
  })
})

describe('cómo se cuentan y se dicen los cupos', () => {
  it('un grupo pasado de capacidad muestra 0, no un negativo', () => {
    expect(cuposLibres({ max_students: 10, activos: 13 })).toBe(0)
    expect(textoDeCupos({ max_students: 10, activos: 13 })).toBe('Sin campos')
  })

  it('el singular se lee bien', () => {
    expect(textoDeCupos({ max_students: 10, activos: 9 })).toBe('Queda 1 campo')
    expect(textoDeCupos({ max_students: 10, activos: 7 })).toBe('Quedan 3 campos')
  })

  it('sin capacidad declarada la barra no divide entre cero', () => {
    expect(proporcionLlena({ max_students: null, activos: 5 })).toBe(0)
    expect(proporcionLlena({ max_students: 0, activos: 5 })).toBe(0)
  })

  it('la barra nunca pasa de llena', () => {
    expect(proporcionLlena({ max_students: 10, activos: 13 })).toBe(1)
    expect(proporcionLlena({ max_students: 10, activos: 5 })).toBe(0.5)
  })
})

describe('el rango de edad', () => {
  it('sin rango no dice nada', () => {
    expect(textoDeEdad({})).toBeNull()
    expect(textoDeEdad({ age_min: null, age_max: null })).toBeNull()
  })

  it('con un solo extremo lo dice sin inventar el otro', () => {
    expect(textoDeEdad({ age_min: 18 })).toBe('Desde los 18 años')
    expect(textoDeEdad({ age_max: 25 })).toBe('Hasta los 25 años')
  })
})

describe('EST-20 · quién puede compartir el enlace', () => {
  it('admin y coordinación de estudios, sí', () => {
    expect(puedeCompartirEnlacePublico(['admin'])).toBe(true)
    expect(puedeCompartirEnlacePublico(['coordinador_estudios'])).toBe(true)
  })

  it('nadie más, aunque trabaje en estudios', () => {
    // La página es pública: no se protege un secreto. Lo que se acota es
    // QUIÉN difunde la matrícula y cuándo — con el botón a la vista de
    // todos, cada quien lo manda por su lado.
    for (const r of [[], ['dirigente'], ['finanzas'], ['editor_grupos_estudio'], ['direccion']]) {
      expect(puedeCompartirEnlacePublico(r), JSON.stringify(r)).toBe(false)
    }
  })
})
