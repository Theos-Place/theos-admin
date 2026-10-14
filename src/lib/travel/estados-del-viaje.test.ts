import { describe, it, expect } from 'vitest'
import {
  puedeMover, actorDe, esEditable, puedePedirViaje,
  PASOS, ESTADOS_DE_VIAJE, ESTADOS_DE_FASE_A, ESTADOS_ABIERTOS,
} from './estados-del-viaje'

describe('FIN-11 · el camino del expediente', () => {
  it('el solicitante envía su borrador', () => {
    expect(puedeMover('borrador', 'enviada', 'solicitante', null)).toEqual({ ok: true })
  })

  it('finanzas la toma, pero NO la aprueba', () => {
    expect(puedeMover('enviada', 'en_revision', 'revision', null)).toEqual({ ok: true })
    const r = puedeMover('en_revision', 'aprobada', 'revision', null)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('la autoridad que aprueba')
  })

  it('LA TERCERA FIRMA ES DE OTRA MANO: aprueba la autoridad competente', () => {
    // Es la razón de ser de la cadena. Si finanzas pudiera revisar y aprobar,
    // el control de tres firmas del reglamento se vuelve una sola.
    expect(puedeMover('en_revision', 'aprobada', 'autoridad', null)).toEqual({ ok: true })
  })

  it('no se salta la revisión: de enviada no se va directo a aprobada', () => {
    const r = puedeMover('enviada', 'aprobada', 'autoridad', null)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('no puede pasar')
  })

  it('rechazar y devolver EXIGEN decir por qué', () => {
    // Un rechazo sin motivo deja a la persona sin saber qué corregir, y al
    // expediente sin nada que mirar dentro de seis meses.
    expect(puedeMover('en_revision', 'rechazada', 'revision', '  ').ok).toBe(false)
    expect(puedeMover('en_revision', 'rechazada', 'revision', 'falta la agenda').ok).toBe(true)
    expect(puedeMover('en_revision', 'por_corregir', 'revision', null).ok).toBe(false)
    expect(puedeMover('en_revision', 'por_corregir', 'revision', 'cambiá el hospedaje').ok).toBe(true)
  })

  it('aprobar NO exige nota: la firma es la nota', () => {
    expect(puedeMover('en_revision', 'aprobada', 'autoridad', null).ok).toBe(true)
  })

  it('lo devuelto se corrige y se vuelve a enviar', () => {
    expect(puedeMover('por_corregir', 'enviada', 'solicitante', null).ok).toBe(true)
  })

  it('el solicitante cancela mientras siga abierto, y no después', () => {
    expect(puedeMover('borrador', 'cancelada', 'solicitante', null).ok).toBe(true)
    expect(puedeMover('enviada', 'cancelada', 'solicitante', null).ok).toBe(true)
    expect(puedeMover('aprobada', 'cancelada', 'solicitante', null).ok).toBe(false)
  })

  it('de un estado final no se sale', () => {
    for (const final of ['aprobada', 'rechazada', 'cancelada'] as const) {
      expect(PASOS.filter(p => p.de === final)).toEqual([])
    }
  })

  it('nadie se aprueba el viaje a sí mismo por ser el dueño', () => {
    // `actorDe` es lo único que decide, y el dueño sin rol es 'solicitante'.
    expect(actorDe([], true)).toBe('solicitante')
    expect(puedeMover('en_revision', 'aprobada', 'solicitante', null).ok).toBe(false)
  })
})

describe('FIN-11 · qué actor es cada quien', () => {
  it('dirección y admin son la autoridad', () => {
    expect(actorDe(['direccion'], false)).toBe('autoridad')
    expect(actorDe(['admin'], false)).toBe('autoridad')
  })

  it('finanzas revisa', () => {
    expect(actorDe(['finanzas'], false)).toBe('revision')
  })

  it('el más alto gana: finanzas Y dirección es autoridad', () => {
    expect(actorDe(['finanzas', 'direccion'], false)).toBe('autoridad')
  })

  it('quien no es nada y no es el dueño, no es actor', () => {
    expect(actorDe(['folletos'], false)).toBeNull()
  })

  it('OJO: dirección sobre su PROPIO viaje sigue siendo autoridad', () => {
    // Queda escrito porque es una decisión, no un descuido: con la cadena de
    // hoy, quien dirige puede aprobar su propio viaje. Si el reglamento pide
    // que no, el cambio va acá y este test cambia con él.
    expect(actorDe(['direccion'], true)).toBe('autoridad')
  })
})

describe('FIN-11 · quién puede pedir un viaje', () => {
  it('alguien con un rol de trabajo, sí', () => {
    expect(puedePedirViaje(['finanzas'])).toBe(true)
    expect(puedePedirViaje(['dirigente'])).toBe(true)
  })

  it('un miembro raso, no', () => {
    expect(puedePedirViaje(['miembro'])).toBe(false)
    expect(puedePedirViaje([])).toBe(false)
    expect(puedePedirViaje(['miembro', 'solo_lectura'])).toBe(false)
  })
})

describe('FIN-11 · cuándo se puede seguir editando', () => {
  it('el borrador y lo devuelto, sí', () => {
    expect(esEditable('borrador')).toBe(true)
    expect(esEditable('por_corregir')).toBe(true)
  })

  it('una vez enviada, NO', () => {
    // Si no, se aprueba una cosa y queda guardada otra.
    expect(esEditable('enviada')).toBe(false)
    expect(esEditable('en_revision')).toBe(false)
    expect(esEditable('aprobada')).toBe(false)
  })
})

describe('FIN-11 · la lista de estados', () => {
  it('los de la fase A son todos los que algún paso usa', () => {
    const usados = new Set([...PASOS.map(p => p.de), ...PASOS.map(p => p.a)])
    for (const e of usados) expect(ESTADOS_DE_FASE_A).toContain(e)
  })

  it('los de fases siguientes están declarados pero no se usan todavía', () => {
    const usados = new Set([...PASOS.map(p => p.de), ...PASOS.map(p => p.a)])
    for (const e of ['liquidada', 'cerrada', 'en_viaje']) {
      expect(ESTADOS_DE_VIAJE).toContain(e)
      expect(usados.has(e as never)).toBe(false)
    }
  })

  it('abiertos = los que todavía esperan a alguien', () => {
    expect([...ESTADOS_ABIERTOS]).toEqual(['borrador', 'enviada', 'en_revision', 'por_corregir'])
    for (const e of ESTADOS_ABIERTOS) expect(ESTADOS_DE_FASE_A).toContain(e)
  })
})
