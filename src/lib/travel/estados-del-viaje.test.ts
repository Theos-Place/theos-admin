import { describe, it, expect } from 'vitest'
import {
  puedeMover, actoresDe, esEditable, puedePedirViaje,
  PASOS, ESTADOS_DE_VIAJE, ESTADOS_DE_FASE_A, ESTADOS_DE_FASE_B, ESTADOS_ABIERTOS,
  seLiquida, puedeEntrarAViaticos,
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
    // «aprobada» dejó de ser final en la fase B: de ahí sigue el viaje y su
    // liquidación. Finales de verdad son estos tres.
    for (const final of ['rechazada', 'cancelada', 'cerrada'] as const) {
      expect(PASOS.filter(p => p.de === final)).toEqual([])
    }
  })

  it('nadie se aprueba el viaje a sí mismo por ser el dueño', () => {
    expect(actoresDe([], true)).toEqual(['solicitante'])
    expect(puedeMover('en_revision', 'aprobada', ['solicitante'], null).ok).toBe(false)
  })
})

describe('FIN-11 · qué papeles puede hacer cada quien', () => {
  it('dirección es la autoridad; admin es las dos cosas', () => {
    // `admin` está en las dos listas a propósito: si no, un bloqueo en el
    // flujo no lo puede destrabar nadie.
    expect(actoresDe(['direccion'], false)).toEqual(['autoridad'])
    expect(actoresDe(['admin'], false)).toEqual(['revision', 'autoridad'])
  })

  it('finanzas revisa', () => {
    expect(actoresDe(['finanzas'], false)).toEqual(['revision'])
  })

  it('CON LOS DOS ROLES SE PUEDEN DAR LOS DOS PASOS', () => {
    // La primera versión devolvía un solo actor y «el más alto ganaba». Se
    // cayó probando el flujo completo: quien tiene finanzas Y dirección —y
    // cualquier admin— quedaba como autoridad a secas y ya no podía TOMAR un
    // expediente para revisarlo, porque ese paso es de 'revision'. El
    // expediente se trababa sin forma de destrabarlo.
    expect(actoresDe(['finanzas', 'direccion'], false)).toEqual(['revision', 'autoridad'])
    expect(puedeMover('enviada', 'en_revision', ['revision', 'autoridad'], null).ok).toBe(true)
    expect(puedeMover('en_revision', 'aprobada', ['revision', 'autoridad'], null).ok).toBe(true)
  })

  it('un admin puede destrabar cualquier paso', () => {
    const suyos = actoresDe(['admin'], true)
    expect(suyos).toEqual(['solicitante', 'revision', 'autoridad'])
    for (const p of PASOS) expect(puedeMover(p.de, p.a, suyos, 'motivo').ok).toBe(true)
  })

  it('quien no es nada y no es el dueño, no tiene papel', () => {
    expect(actoresDe(['folletos'], false)).toEqual([])
  })

  it('el dueño con rol de finanzas es las dos cosas', () => {
    expect(actoresDe(['finanzas'], true)).toEqual(['solicitante', 'revision'])
  })

  it('OJO: dirección sobre su PROPIO viaje puede aprobarlo', () => {
    // Queda escrito porque es una decisión, no un descuido. Si el reglamento
    // pide que sean tres PERSONAS distintas y no tres roles, se compara
    // contra quién dio el paso anterior — y este test cambia con eso.
    expect(actoresDe(['direccion'], true)).toEqual(['solicitante', 'autoridad'])
    expect(puedeMover('en_revision', 'aprobada', ['solicitante', 'autoridad'], null).ok).toBe(true)
  })
})

describe('FIN-11 · quién puede pedir un viaje', () => {
  it('solo quien tiene ficha de empleado', () => {
    // Floriana, 2026-10-14: «por ahora nadie, hasta que se llene la lista de
    // empleados». Es una fila viva en `employees`, no un rol.
    expect(puedePedirViaje(true)).toBe(true)
  })

  it('un rol de trabajo NO alcanza: dirigentes y folletos quedaron fuera', () => {
    expect(puedePedirViaje(false)).toBe(false)
    expect(puedePedirViaje(null)).toBe(false)
    expect(puedePedirViaje(undefined)).toBe(false)
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
  it('cada estado que un paso usa está declarado en su fase', () => {
    const usados = new Set([...PASOS.map(p => p.de), ...PASOS.map(p => p.a)])
    for (const e of usados) {
      expect([...ESTADOS_DE_FASE_A, ...ESTADOS_DE_FASE_B]).toContain(e)
    }
  })

  it('«en_viaje» sigue declarado y sin usar: no hay fase que lo ocupe', () => {
    // Queda en la lista porque el plan lo nombra, pero ningún paso lo toca:
    // nadie iba a entrar a marcar «ya salí», y un estado que nadie pone deja
    // los expedientes trabados.
    const usados = new Set([...PASOS.map(p => p.de), ...PASOS.map(p => p.a)])
    expect(ESTADOS_DE_VIAJE).toContain('en_viaje')
    expect(usados.has('en_viaje')).toBe(false)
  })

  it('abiertos = los que todavía esperan a alguien', () => {
    // Un viaje aprobado sin liquidar NO está cerrado: alguien le debe plata a
    // alguien hasta que se liquide.
    expect([...ESTADOS_ABIERTOS]).toEqual([
      'borrador', 'enviada', 'en_revision', 'por_corregir',
      'aprobada', 'anticipo_entregado', 'liquidacion_pendiente', 'liquidada',
    ])
    for (const e of ['rechazada', 'cancelada', 'cerrada'] as const) {
      expect(ESTADOS_ABIERTOS).not.toContain(e)
    }
  })
})


describe('FIN-11 fase B · de aprobada a cerrada', () => {
  it('el anticipo lo marca finanzas, no quien lo recibe', () => {
    expect(puedeMover('aprobada', 'anticipo_entregado', 'revision', null).ok).toBe(true)
    expect(puedeMover('aprobada', 'anticipo_entregado', 'solicitante', null).ok).toBe(false)
  })

  it('«ya volví» entra con anticipo y sin anticipo', () => {
    // Un viaje sin anticipo no pasa por anticipo_entregado, y obligarlo sería
    // inventarle un anticipo de cero.
    expect(puedeMover('aprobada', 'liquidacion_pendiente', 'solicitante', null).ok).toBe(true)
    expect(puedeMover('anticipo_entregado', 'liquidacion_pendiente', 'solicitante', null).ok).toBe(true)
  })

  it('la liquidación la manda quien viajó y la cierra finanzas', () => {
    expect(puedeMover('liquidacion_pendiente', 'liquidada', 'solicitante', null).ok).toBe(true)
    expect(puedeMover('liquidada', 'cerrada', 'revision', null).ok).toBe(true)
    expect(puedeMover('liquidada', 'cerrada', 'solicitante', null).ok).toBe(false)
  })

  it('devolver la liquidación exige decir qué está mal', () => {
    expect(puedeMover('liquidada', 'liquidacion_pendiente', 'revision', null).ok).toBe(false)
    expect(puedeMover('liquidada', 'liquidacion_pendiente', 'revision', 'falta la factura del hotel').ok).toBe(true)
  })

  it('no se salta la liquidación: de aprobada no se va a cerrada', () => {
    expect(puedeMover('aprobada', 'cerrada', 'revision', null).ok).toBe(false)
    expect(puedeMover('aprobada', 'liquidada', 'solicitante', null).ok).toBe(false)
  })

  it('los GASTOS se tocan solo mientras se liquida', () => {
    // Es otra cosa que `esEditable`, que habla del presupuesto: tener una
    // sola función dejaría editar el presupuesto de un viaje ya aprobado.
    expect(seLiquida('liquidacion_pendiente')).toBe(true)
    expect(seLiquida('liquidada')).toBe(false)
    expect(seLiquida('aprobada')).toBe(false)
    expect(esEditable('liquidacion_pendiente')).toBe(false)
  })
})

describe('FIN-11 · quién ENTRA a la pantalla', () => {
  it('el empleado, aunque no tenga ningún rol de revisión', () => {
    expect(puedeEntrarAViaticos(true, [])).toBe(true)
  })

  it('finanzas y dirección, aunque no sean empleados', () => {
    expect(puedeEntrarAViaticos(false, ['finanzas'])).toBe(true)
    expect(puedeEntrarAViaticos(false, ['direccion'])).toBe(true)
  })

  it('un dirigente sin ficha de empleado, NO', () => {
    expect(puedeEntrarAViaticos(false, ['dirigente'])).toBe(false)
    expect(puedeEntrarAViaticos(undefined, ['folletos'])).toBe(false)
  })
})
