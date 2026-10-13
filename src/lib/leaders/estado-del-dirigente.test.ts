import { describe, it, expect } from 'vitest'
import {
  motivoInvalido, esValido, resumen, admiteNota,
  RAZONES_NO_DISPONIBLE, RAZONES_DE_REVISION, RAZON_AUTOMATICA,
  type EstadoDelDirigente,
} from './estado-del-dirigente'

const activo = (o: Partial<EstadoDelDirigente> = {}): EstadoDelDirigente => ({
  base: 'activo', razonInactivo: null, detalleNoEjerce: null, situacionCdeb: null,
  disponibilidad: 'disponible', razonNoDisponible: null, pausaHasta: null, revision: [], ...o,
})
const inactivo = (o: Partial<EstadoDelDirigente> = {}): EstadoDelDirigente => ({
  base: 'inactivo', razonInactivo: 'no_asiste', detalleNoEjerce: null, situacionCdeb: null,
  disponibilidad: null, razonNoDisponible: null, pausaHasta: null, revision: [], ...o,
})

describe('DIR-8 · un dirigente ACTIVO', () => {
  it('disponible, sin nada más, es válido', () => {
    expect(esValido(activo())).toBe(true)
  })

  it('no disponible exige decir POR QUÉ', () => {
    expect(motivoInvalido(activo({ disponibilidad: 'no_disponible' })))
      .toMatch(/por qué no está disponible/)
  })

  it('las cinco razones de no disponibilidad valen', () => {
    for (const r of RAZONES_NO_DISPONIBLE) {
      const e = activo({
        disponibilidad: 'no_disponible', razonNoDisponible: r,
        pausaHasta: r === 'pausa' ? '2027-02-01' : null,
      })
      expect(esValido(e), r).toBe(true)
    }
  })

  it('una PAUSA sin fecha de regreso no se guarda', () => {
    // Una pausa sin fecha es una baja que nadie se anima a declarar: seis
    // meses después nadie sabe si la persona vuelve.
    expect(motivoInvalido(activo({
      disponibilidad: 'no_disponible', razonNoDisponible: 'pausa',
    }))).toMatch(/fecha de regreso/)
  })

  it('la fecha de regreso NO se cuela en otras razones', () => {
    expect(motivoInvalido(activo({
      disponibilidad: 'no_disponible', razonNoDisponible: 'pasantia', pausaHasta: '2027-01-01',
    }))).toMatch(/solo para una pausa/)
  })

  it('disponible y con razón de no disponibilidad es contradictorio', () => {
    expect(motivoInvalido(activo({ razonNoDisponible: 'pausa' })))
      .toMatch(/no lleva razón de no disponibilidad/)
  })

  it('un activo no arrastra razones de inactividad', () => {
    expect(motivoInvalido(activo({ razonInactivo: 'no_asiste' })))
      .toMatch(/no lleva razones de inactividad/)
  })
})

describe('DIR-8 · un dirigente INACTIVO', () => {
  it('«no asiste» se guarda sin más detalle', () => {
    expect(esValido(inactivo())).toBe(true)
  })

  it('«asiste pero no ejerce» exige el detalle', () => {
    expect(motivoInvalido(inactivo({ razonInactivo: 'asiste_no_ejerce' })))
      .toMatch(/CDEB o si fue decisión propia/)
  })

  it('«no aprobó CDEB» exige decir si es definitivo o con seguimiento', () => {
    expect(motivoInvalido(inactivo({
      razonInactivo: 'asiste_no_ejerce', detalleNoEjerce: 'no_aprobo_cdeb',
    }))).toMatch(/definitivo o si se le da seguimiento/)
  })

  it('la rama completa del CDEB es válida', () => {
    for (const s of ['definitivo', 'seguimiento'] as const) {
      expect(esValido(inactivo({
        razonInactivo: 'asiste_no_ejerce', detalleNoEjerce: 'no_aprobo_cdeb', situacionCdeb: s,
      })), s).toBe(true)
    }
  })

  it('«decisión propia» NO lleva situación de CDEB', () => {
    expect(motivoInvalido(inactivo({
      razonInactivo: 'asiste_no_ejerce', detalleNoEjerce: 'decision_propia',
      situacionCdeb: 'definitivo',
    }))).toMatch(/no aplica a una decisión propia/)
  })

  it('«no asiste» no lleva detalle de por qué no ejerce', () => {
    expect(motivoInvalido(inactivo({ detalleNoEjerce: 'decision_propia' })))
      .toMatch(/solo para quien asiste pero no ejerce/)
  })

  it('un inactivo NO lleva disponibilidad: eso es de los activos', () => {
    expect(motivoInvalido(inactivo({ disponibilidad: 'disponible' })))
      .toMatch(/no lleva disponibilidad/)
  })

  it('siempre hay que decir por qué está inactivo', () => {
    expect(motivoInvalido(inactivo({ razonInactivo: null })))
      .toMatch(/por qué está inactivo/)
  })
})

describe('DIR-8 · la banderita de revisión', () => {
  it('coexiste con CUALQUIER estado, incluido inactivo', () => {
    // Es el cambio del rediseño: «en revisión» dejó de ser un estado que
    // tapaba los demás y pasó a ser una marca que convive con ellos.
    for (const r of RAZONES_DE_REVISION) {
      expect(esValido(activo({ revision: [r] })), r).toBe(true)
      expect(esValido(inactivo({ revision: [r] })), r).toBe(true)
    }
  })

  it('pueden ser varias a la vez', () => {
    expect(esValido(activo({ revision: ['testimonio', 'compromiso'] }))).toBe(true)
  })

  it('y ninguna es lo normal', () => {
    expect(esValido(activo({ revision: [] }))).toBe(true)
  })
})

describe('DIR-8 · dónde se puede escribir una nota', () => {
  it('solo en los cinco lugares del diagrama', () => {
    for (const l of ['revision', 'cdeb_definitivo', 'cdeb_seguimiento', 'decision_propia', 'pausa']) {
      expect(admiteNota(l), l).toBe(true)
    }
  })

  it('y en ningún otro: un campo por nodo es un formulario que nadie llena', () => {
    for (const l of ['no_asiste', 'dirigiendo', 'pasantia', 'disponible', 'activo']) {
      expect(admiteNota(l), l).toBe(false)
    }
  })
})

describe('DIR-8 · cómo se lee el estado', () => {
  it('el activo disponible, en una línea', () => {
    expect(resumen(activo())).toBe('Activo · Disponible')
  })

  it('el no disponible dice la razón, no «no disponible» a secas', () => {
    expect(resumen(activo({
      disponibilidad: 'no_disponible', razonNoDisponible: 'dirigiendo',
    }))).toBe('Activo · Dirigiendo un estudio')
  })

  it('el inactivo encadena hasta el último detalle', () => {
    expect(resumen(inactivo({
      razonInactivo: 'asiste_no_ejerce', detalleNoEjerce: 'no_aprobo_cdeb',
      situacionCdeb: 'seguimiento',
    }))).toBe('Inactivo · Asiste, pero no ejerce este servicio · No aprobó el CDEB · Se le da seguimiento')
  })
})

describe('DIR-8 · qué pone el sistema solo', () => {
  it('«dirigiendo» es la única razón automática', () => {
    // Las demás las elige coordinación. Si otra se volviera automática,
    // habría que decirlo acá y en la ficha, o nadie entendería por qué su
    // selección se revierte sola.
    expect(RAZON_AUTOMATICA).toBe('dirigiendo')
  })

  it('la banderita de datos sin confirmar es MANUAL', () => {
    // Decisión de Floriana del 2026-10-12: el diagrama la pinta distinta
    // (roja, «3 veces al año») pero se pone a mano, como las otras tres.
    expect(RAZONES_DE_REVISION).toContain('no_confirmo_datos')
    expect(RAZON_AUTOMATICA).not.toBe('no_confirmo_datos')
  })
})
