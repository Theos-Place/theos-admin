import { describe, it, expect } from 'vitest'
import { accionesDelFormulario, puedeCrearFormularios, puedeRepartirAcceso } from './acciones-del-listado'
import type { RoleId } from '@/types/auth'

const FORM = 'af0a33f8-359f-4407-9eb2-17f91d52d682'
const OTRO = '30b0c4c9-8bd4-490e-bcb4-7abc46acb4c4'

describe('a dónde lleva hacer click en un formulario del listado', () => {
  it('con el módulo, al detalle del formulario', () => {
    const a = accionesDelFormulario({ roles: ['forms'] as RoleId[], formId: FORM })
    expect(a.destino).toBe(`/formularios/${FORM}`)
    expect(a.muestraEditar).toBe(true)
    expect(a.muestraRespuestas).toBe(true)
    expect(a.muestraDuplicar).toBe(true)
  })

  it('con un acceso puntual, al formulario — que ahora sí puede editar', () => {
    const a = accionesDelFormulario({
      roles: ['lider_comite'] as RoleId[],
      formId: FORM,
      grantedFormIds: [FORM, OTRO],
    })
    expect(a.destino).toBe(`/formularios/${FORM}`)
    expect(a.muestraEditar).toBe(true)
    expect(a.muestraRespuestas).toBe(true)
  })

  it('un acceso puntual NO habilita duplicar: eso crea un formulario nuevo', () => {
    const a = accionesDelFormulario({
      roles: ['lider_comite'] as RoleId[],
      formId: FORM,
      grantedFormIds: [FORM],
    })
    expect(a.muestraDuplicar).toBe(false)
  })

  it('sin módulo y sin acceso a ESE formulario, no se le ofrecen respuestas', () => {
    const a = accionesDelFormulario({
      roles: ['lider_comite'] as RoleId[],
      formId: FORM,
      grantedFormIds: [OTRO],
    })
    expect(a.muestraRespuestas).toBe(false)
    expect(a.muestraEditar).toBe(false)
  })

  it('solo lectura entra al detalle pero no edita ni duplica', () => {
    const a = accionesDelFormulario({ roles: ['solo_lectura'] as RoleId[], formId: FORM })
    expect(a.destino).toBe(`/formularios/${FORM}`)
    expect(a.muestraEditar).toBe(false)
    expect(a.muestraRespuestas).toBe(true)
    expect(a.muestraDuplicar).toBe(false)
  })

  it('sin roles ni accesos, nada', () => {
    const a = accionesDelFormulario({ roles: [], formId: FORM, grantedFormIds: [] })
    expect(a.muestraEditar).toBe(false)
    expect(a.muestraRespuestas).toBe(false)
  })
})

describe('crear formularios', () => {
  it('lo ofrece el módulo', () => {
    expect(puedeCrearFormularios(['forms'] as RoleId[])).toBe(true)
  })

  it('un acceso puntual NO habilita crear', () => {
    expect(puedeCrearFormularios(['lider_comite'] as RoleId[])).toBe(false)
  })

  it('solo lectura tampoco', () => {
    expect(puedeCrearFormularios(['solo_lectura'] as RoleId[])).toBe(false)
  })
})

describe('repartir el acceso a un formulario', () => {
  it('lo puede hacer quien ya lo tiene compartido', () => {
    expect(puedeRepartirAcceso({
      roles: ['lider_comite'] as RoleId[], formId: FORM, grantedFormIds: [FORM],
    })).toBe(true)
  })

  it('pero solo el de ESE formulario, no el de otro', () => {
    expect(puedeRepartirAcceso({
      roles: ['lider_comite'] as RoleId[], formId: FORM, grantedFormIds: [OTRO],
    })).toBe(false)
  })

  it('el módulo con edición también', () => {
    expect(puedeRepartirAcceso({ roles: ['forms'] as RoleId[], formId: FORM })).toBe(true)
  })

  it('solo lectura no reparte accesos', () => {
    expect(puedeRepartirAcceso({ roles: ['solo_lectura'] as RoleId[], formId: FORM })).toBe(false)
  })
})
