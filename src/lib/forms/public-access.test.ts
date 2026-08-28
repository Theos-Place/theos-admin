import { describe, it, expect } from 'vitest'
import {
  esFormularioAbierto, faltaEnEnvioInvitado, claveLimite, ENVIOS_MAX_POR_IP,
} from './public-access'

const f = (o: Partial<Parameters<typeof esFormularioAbierto>[0]>) =>
  ({ is_public: true, requires_auth: false, is_active: true, ...o })

describe('esFormularioAbierto', () => {
  it('abierto solo con las DOS banderas', () => {
    expect(esFormularioAbierto(f({}))).toBe(true)
  })
  it('con requires_auth sigue pidiendo cuenta, aunque sea "público"', () => {
    // Es el estado de los 23 formularios de hoy: link para cualquiera, con cuenta.
    expect(esFormularioAbierto(f({ requires_auth: true }))).toBe(false)
  })
  it('sin is_public NO se abre, aunque no pida cuenta', () => {
    // La peor combinación posible: un formulario de convocatoria expuesto sin
    // filtro. Se exige marcar las dos a propósito.
    expect(esFormularioAbierto(f({ is_public: false }))).toBe(false)
  })
  it('un formulario inactivo no se abre por más banderas que tenga', () => {
    expect(esFormularioAbierto(f({ is_active: false }))).toBe(false)
  })
})

describe('faltaEnEnvioInvitado', () => {
  it('completo no falta nada', () => {
    expect(faltaEnEnvioInvitado({ nombre: 'Ana Mora', correo: 'ana@x.test' })).toBeNull()
  })
  it('exige nombre y correo: son la única identidad de esa respuesta', () => {
    expect(faltaEnEnvioInvitado({ correo: 'ana@x.test' })).toContain('nombre')
    expect(faltaEnEnvioInvitado({ nombre: 'Ana' })).toContain('correo')
    expect(faltaEnEnvioInvitado({ nombre: '   ', correo: 'ana@x.test' })).toContain('nombre')
  })
  it('rechaza un correo que no lo es', () => {
    expect(faltaEnEnvioInvitado({ nombre: 'Ana', correo: 'ana@' })).toContain('válido')
    expect(faltaEnEnvioInvitado({ nombre: 'Ana', correo: 'ana' })).toContain('válido')
  })
})

describe('claveLimite', () => {
  it('separa por formulario: llenar uno no bloquea los otros', () => {
    expect(claveLimite('f1', '1.2.3.4')).not.toBe(claveLimite('f2', '1.2.3.4'))
  })
  it('separa por IP', () => {
    expect(claveLimite('f1', '1.2.3.4')).not.toBe(claveLimite('f1', '5.6.7.8'))
  })
  it('sin IP no colapsa con una IP real', () => {
    expect(claveLimite('f1', '')).toContain('sin-ip')
  })
  it('el tope deja pasar a una familia y no a un bot', () => {
    expect(ENVIOS_MAX_POR_IP).toBeGreaterThanOrEqual(3)
    expect(ENVIOS_MAX_POR_IP).toBeLessThanOrEqual(10)
  })
})
