import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { linkAttemptOrder, shouldTryOtherKind } from './password-link-plan'

describe('linkAttemptOrder', () => {
  it('con cuenta: primero recuperar', () => {
    expect(linkAttemptOrder(true)).toEqual(['recovery', 'invite'])
  })

  it('sin cuenta: primero invitar (la crea)', () => {
    expect(linkAttemptOrder(false)).toEqual(['invite', 'recovery'])
  })

  it('siempre hay un segundo intento: la pista puede estar mal', () => {
    expect(linkAttemptOrder(true).length).toBe(2)
    expect(linkAttemptOrder(false).length).toBe(2)
  })
})

describe('shouldTryOtherKind', () => {
  it('reintenta cuando el usuario ya existe', () => {
    expect(shouldTryOtherKind('User already registered')).toBe(true)
    expect(shouldTryOtherKind('A user with this email address has already been registered')).toBe(true)
  })

  it('reintenta cuando el usuario no existe', () => {
    expect(shouldTryOtherKind('User not found')).toBe(true)
    expect(shouldTryOtherKind('no user found with that email')).toBe(true)
  })

  it('NO reintenta ante otros errores (un SMTP caído no se arregla cambiando el tipo)', () => {
    expect(shouldTryOtherKind('Error sending email: connection refused')).toBe(false)
    expect(shouldTryOtherKind('rate limit exceeded')).toBe(false)
    expect(shouldTryOtherKind('')).toBe(false)
    expect(shouldTryOtherKind(null)).toBe(false)
  })
})

describe('el endpoint no puede decir "ya te lo mandamos" sin mandarlo', () => {
  // Caso real (2026-08-31): una persona no recibía el enlace, reintentaba,
  // quemaba los 3 intentos de la ventana y a partir de ahí la pantalla le
  // decía "ya le mandamos el enlace, revisá tu spam" sin que saliera un solo
  // correo. Estuvo toda una tarde en eso.
  const ruta = readFileSync(
    join(process.cwd(), 'src/app/api/auth/password-link/route.ts'), 'utf8',
  )

  it('el límite por identificador responde 429, no la respuesta neutral', () => {
    const bloque = ruta.slice(ruta.indexOf('pwlink:id:'))
    const hasta = bloque.slice(0, bloque.indexOf('}\n'))
    expect(hasta).toContain('429')
    expect(hasta).not.toContain('RESPUESTA_NEUTRAL')
  })

  it('la respuesta neutral sigue existiendo para el caso normal', () => {
    // No se cambió lo otro: si la cuenta no existe, la respuesta es la misma
    // que si existiera. Esa protección se queda.
    expect(ruta).toContain('RESPUESTA_NEUTRAL')
  })
})
