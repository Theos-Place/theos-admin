import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  esMenor, edadDesconocida, puedeCrearseCuenta, exigeContacto,
  mismoTelefono, mismoCorreo,
} from './reglas-de-menores'

const HOY = '2026-09-15'
const nacido = (birth_date: string | null) => ({ birth_date })

describe('quién es menor', () => {
  it('cuenta los años cumplidos, no el año de nacimiento', () => {
    expect(esMenor(nacido('2008-09-16'), HOY)).toBe(true)   // cumple mañana
    expect(esMenor(nacido('2008-09-15'), HOY)).toBe(false)  // cumple hoy: ya es mayor
  })

  it('sin fecha NO se asume menor, pero queda marcado para revisar', () => {
    // Hay 3.260 fichas sin fecha. Bloquearlas "por las dudas" rompería el alta
    // de miles de adultos para proteger a los pocos que además son menores.
    expect(esMenor(nacido(null), HOY)).toBe(false)
    expect(edadDesconocida(nacido(null))).toBe(true)
    expect(edadDesconocida(nacido('2008-01-01'))).toBe(false)
  })
})

describe('cuenta de acceso', () => {
  it('a un menor no se le crea', () => {
    expect(puedeCrearseCuenta(nacido('2012-01-01'), HOY)).toBe(false)
  })
  it('a un adulto sí', () => {
    expect(puedeCrearseCuenta(nacido('1990-01-01'), HOY)).toBe(true)
  })
  it('datos protegidos manda aunque sea mayor', () => {
    // La regla de 2026-09-10 ya existía y no la reemplaza la de la edad.
    expect(puedeCrearseCuenta({ birth_date: '1990-01-01', datos_protegidos: true }, HOY)).toBe(false)
  })
  it('sin fecha se permite: no se le niega la cuenta a alguien por un dato faltante', () => {
    expect(puedeCrearseCuenta(nacido(null), HOY)).toBe(true)
  })
})

describe('correo y teléfono obligatorios', () => {
  it('a un menor no se le exigen', () => {
    expect(exigeContacto(nacido('2015-05-05'), HOY)).toBe(false)
  })
  it('a un adulto sí', () => {
    expect(exigeContacto(nacido('1985-05-05'), HOY)).toBe(true)
  })
})

describe('datos prestados de un adulto de la familia', () => {
  it('reconoce el mismo teléfono escrito distinto', () => {
    expect(mismoTelefono('8862 8716', '88628716')).toBe(true)
    expect(mismoTelefono('+506 8862-8716', '8862.8716')).toBe(false) // el 506 lo hace otro número
  })

  it('un número corto repetido no prueba nada', () => {
    // Sin el mínimo de 8 dígitos, dos fichas con "123" se darían por iguales.
    expect(mismoTelefono('123', '123')).toBe(false)
    expect(mismoTelefono('', '')).toBe(false)
  })

  it('el correo compara sin mayúsculas ni espacios', () => {
    expect(mismoCorreo('  Mama@Correo.com ', 'mama@correo.com')).toBe(true)
    expect(mismoCorreo('', '')).toBe(false)
    expect(mismoCorreo(null, null)).toBe(false)
  })
})

describe('el bloqueo está donde no se puede saltar', () => {
  // Hay tres caminos que crean cuentas (el botón de la ficha, el alta de
  // miembro y el registro público). El guard va dentro de la función común, no
  // en cada endpoint: un chequeo por endpoint es un chequeo que se olvida.
  const leer = (p: string) => readFileSync(p, 'utf8')

  it('inviteMemberToCompleteProfile rechaza a un menor', () => {
    const inv = leer('src/lib/auth/invite.ts')
    expect(inv).toMatch(/puedeCrearseCuenta/)
    // Antes de crear el usuario de Auth, no después.
    expect(inv.indexOf('puedeCrearseCuenta')).toBeLessThan(inv.indexOf('createUser'))
  })

  it('el endpoint además responde 403 con su código', () => {
    const r = leer('src/app/api/members/[id]/create-account/route.ts')
    expect(r).toMatch(/menor_sin_cuenta/)
    expect(r).toMatch(/status: 403/)
  })

  it('la ficha dice por qué, no solo esconde el botón', () => {
    expect(leer('src/app/(admin)/miembros/[id]/_components/MemberAdminTab.tsx'))
      .toMatch(/puede_tener_cuenta === false/)
  })
})
