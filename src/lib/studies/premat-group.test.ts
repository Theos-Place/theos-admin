import { describe, it, expect } from 'vitest'
import {
  PREMAT_PLAN_CODE, isPrematGroup, canLeadPremat, prematGroupError,
} from './premat-group'

describe('isPrematGroup', () => {
  it('reconoce el plan, sin importar espacios ni mayúsculas', () => {
    expect(isPrematGroup('PREMAT')).toBe(true)
    expect(isPrematGroup(' premat ')).toBe(true)
  })

  it('cualquier otro plan no lo es', () => {
    for (const c of ['N1', 'DIS3', 'MAT', '', null, undefined]) {
      expect(isPrematGroup(c)).toBe(false)
    }
  })

  // MAT (Matrimonios) es otro estudio: no se confunde con PREMAT.
  it('no confunde MAT con PREMAT', () => {
    expect(isPrematGroup('MAT')).toBe(false)
  })
})

describe('canLeadPremat', () => {
  it('vale con formación o con disponibilidad', () => {
    expect(canLeadPremat({ formacion: ['PREMAT'] })).toBe(true)
    expect(canLeadPremat({ disponibilidad: ['PREMAT'] })).toBe(true)
    expect(canLeadPremat({ formacion: ['N1'], disponibilidad: ['PREMAT'] })).toBe(true)
  })

  it('sin la marca en ninguna, no', () => {
    expect(canLeadPremat({ formacion: ['N1'], disponibilidad: ['DIS2'] })).toBe(false)
    expect(canLeadPremat({})).toBe(false)
    expect(canLeadPremat(null)).toBe(false)
  })

  it('tolera espacios y minúsculas en los códigos guardados', () => {
    expect(canLeadPremat({ formacion: [' premat '] })).toBe(true)
  })
})

describe('prematGroupError', () => {
  const habilitado = { formacion: [PREMAT_PLAN_CODE] }
  const noHabilitado = { formacion: ['N1'] }

  // Lo esencial: en cualquier otro plan esto no aplica y nada cambia.
  it('en un grupo que no es PREMAT nunca bloquea', () => {
    expect(prematGroupError({ planCode: 'N1', leaderId: null, coLeaderId: null })).toBeNull()
    expect(prematGroupError({ planCode: 'DIS3', leaderId: 'a', coLeaderId: null })).toBeNull()
  })

  it('exige dirigente y co-dirigente', () => {
    expect(prematGroupError({ planCode: 'PREMAT', leaderId: null, coLeaderId: null }))
      .toMatch(/elegí el dirigente/i)
    expect(prematGroupError({ planCode: 'PREMAT', leaderId: 'a', coLeaderId: null }))
      .toMatch(/falta el co-dirigente/i)
    expect(prematGroupError({ planCode: 'PREMAT', leaderId: 'a', coLeaderId: '  ' }))
      .toMatch(/falta el co-dirigente/i)
  })

  it('con los dos puestos, pasa', () => {
    expect(prematGroupError({ planCode: 'PREMAT', leaderId: 'a', coLeaderId: 'b' })).toBeNull()
  })

  it('no puede ser la misma persona dos veces', () => {
    expect(prematGroupError({ planCode: 'PREMAT', leaderId: 'a', coLeaderId: 'a' }))
      .toMatch(/dos personas distintas/i)
  })

  it('bloquea a quien no está habilitado', () => {
    const capabilityOf = (id: string) => (id === 'a' ? habilitado : noHabilitado)
    expect(prematGroupError({ planCode: 'PREMAT', leaderId: 'b', coLeaderId: 'a', capabilityOf }))
      .toMatch(/dirigente no está habilitado/i)
    expect(prematGroupError({ planCode: 'PREMAT', leaderId: 'a', coLeaderId: 'b', capabilityOf }))
      .toMatch(/co-dirigente no está habilitado/i)
  })

  it('con los dos habilitados, pasa', () => {
    expect(prematGroupError({
      planCode: 'PREMAT', leaderId: 'a', coLeaderId: 'b', capabilityOf: () => habilitado,
    })).toBeNull()
  })

  // Un dato que no se pudo resolver no puede impedir crear el grupo: el guard de
  // habilitación es una ayuda, no una barrera de seguridad.
  it('si no se puede resolver la habilitación, no bloquea', () => {
    expect(prematGroupError({
      planCode: 'PREMAT', leaderId: 'a', coLeaderId: 'b', capabilityOf: () => null,
    })).toBeNull()
  })

  it('el orden de los mensajes sigue lo que hay que resolver primero', () => {
    // Sin dirigente elegido, no se habla de habilitación.
    expect(prematGroupError({
      planCode: 'PREMAT', leaderId: null, coLeaderId: null, capabilityOf: () => noHabilitado,
    })).toMatch(/elegí el dirigente/i)
  })
})
