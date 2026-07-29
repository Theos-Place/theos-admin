import { describe, it, expect } from 'vitest'
import { openSectionsFromParam } from './profile-deeplink'

describe('openSectionsFromParam (PAG-4)', () => {
  it('?open=pagos abre el acordeón de pagos (link de /mis-pagos al historial)', () => {
    expect(openSectionsFromParam('pagos')).toEqual({ pagos: true })
  })

  it('acepta las demás secciones direccionables', () => {
    expect(openSectionsFromParam('misBecas')).toEqual({ misBecas: true })
    expect(openSectionsFromParam('donaciones')).toEqual({ donaciones: true })
  })

  it('valores fuera de la whitelist o ausentes no abren nada (el param viene del usuario)', () => {
    expect(openSectionsFromParam('__proto__')).toEqual({})
    expect(openSectionsFromParam('loquesea')).toEqual({})
    expect(openSectionsFromParam(null)).toEqual({})
    expect(openSectionsFromParam(undefined)).toEqual({})
  })
})
