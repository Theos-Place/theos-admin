import { describe, it, expect } from 'vitest'
import { ACCESS_EMAIL_ROLES, accesoDesincronizado, errorDeCorreoDeAcceso, normalizarCorreo } from './access-email'

describe('errorDeCorreoDeAcceso', () => {
  it('acepta correos normales', () => {
    for (const c of ['adrijimenezs@gmail.com', ' Ana.Mora+theos@Outlook.CO ', 'a@b.cr'])
      expect(errorDeCorreoDeAcceso(c), c).toBeNull()
  })

  it('rechaza lo que no es un correo', () => {
    for (const c of ['', '   ', null, undefined, 'sin-arroba', 'dos@@arrobas.com', 'sin punto@dominio', 'a@b.c'])
      expect(errorDeCorreoDeAcceso(c), String(c)).not.toBeNull()
  })
})

describe('normalizarCorreo', () => {
  it('recorta y baja a minúsculas — el correo de acceso no distingue', () => {
    expect(normalizarCorreo('  Ana@Gmail.COM ')).toBe('ana@gmail.com')
    expect(normalizarCorreo(null)).toBe('')
  })
})

describe('accesoDesincronizado', () => {
  const base = { tieneCuenta: true }

  it('avisa cuando la ficha y la cuenta no coinciden', () => {
    // El caso real: le cambiaron el correo en el perfil y el login quedó atrás.
    expect(accesoDesincronizado({ ...base, fichaEmail: 'adrijimenezs@gmail.com', cuentaEmail: 'adrichic20@hotmail.com' })).toBe(true)
  })

  it('no avisa si son el mismo, aunque cambie mayúsculas o espacios', () => {
    expect(accesoDesincronizado({ ...base, fichaEmail: ' Ana@Gmail.com', cuentaEmail: 'ana@gmail.com' })).toBe(false)
  })

  it('sin cuenta ligada no hay nada que reportar', () => {
    // Ese es otro estado ("no tiene cuenta de acceso") y tiene su propio aviso.
    expect(accesoDesincronizado({ tieneCuenta: false, fichaEmail: 'a@b.com', cuentaEmail: null })).toBe(false)
  })

  it('con alguno vacío no se inventa una desincronización', () => {
    expect(accesoDesincronizado({ ...base, fichaEmail: null, cuentaEmail: 'a@b.com' })).toBe(false)
    expect(accesoDesincronizado({ ...base, fichaEmail: 'a@b.com', cuentaEmail: '' })).toBe(false)
  })
})

describe('quién puede cambiarlo', () => {
  it('no lo puede la coordinación de estudios solo por serlo', () => {
    // Cambiar el correo de acceso es decidir con qué dirección se entra a una
    // cuenta; apuntarla a un correo propio es quedarse con la cuenta ajena.
    // Por eso es un permiso aparte del que crea cuentas y manda enlaces.
    expect(ACCESS_EMAIL_ROLES).not.toContain('coordinador_estudios')
    expect(ACCESS_EMAIL_ROLES).not.toContain('coordinador_dirigentes')
    expect(ACCESS_EMAIL_ROLES).toContain('gestor_accesos')
  })
})
