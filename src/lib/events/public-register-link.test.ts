// EVE-1 ya resolvía el deep link y el login-gate. Lo nuevo (2026-08-26) es la
// página PÚBLICA del evento, que es lo que se comparte por link o QR.
//
// Por qué una página pública y no compartir /eventos directo: un QR lo escanea
// gente que puede no tener cuenta. Caer en una pantalla de login sin saber a qué
// se está inscribiendo es la forma más rápida de perderla.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { registerDeepLink, loginRedirectTo, publicEventPath, publicEventUrl } from './public-register-link'

const ID = '83b9262b-1f25-400e-bf6d-1e2e0f4c2adf'

describe('la ruta pública del evento', () => {
  it('vive bajo /calendario, que ya es prefijo público', () => {
    expect(publicEventPath(ID)).toBe(`/calendario/${ID}`)
    // Si dejara de estar en PUBLIC_PREFIXES, el link compartido rebotaría al
    // login y se perdería el sentido de la página.
    const proxy = readFileSync('src/proxy.ts', 'utf8')
    expect(proxy).toContain("'/calendario'")
  })

  it('la URL absoluta respeta el origin cuando se le pasa', () => {
    // Importa en los previews de Vercel: sin esto se copiaría el link de
    // producción desde un deployment de prueba.
    expect(publicEventUrl(ID, 'https://preview.vercel.app')).toBe(`https://preview.vercel.app/calendario/${ID}`)
    expect(publicEventUrl(ID, 'https://x.com/')).toBe(`https://x.com/calendario/${ID}`)
  })

  it('el botón reusa el login-gate de EVE-1, no uno nuevo', () => {
    const destino = loginRedirectTo(registerDeepLink(ID))
    expect(destino).toBe(`/login?redirect=${encodeURIComponent(`/eventos?register=${ID}`)}`)
  })
})

describe('la API pública no filtra datos internos', () => {
  const ruta = readFileSync('src/app/api/public/events/[id]/route.ts', 'utf8')

  it('la respuesta es una whitelist, nunca un spread del evento', () => {
    expect(ruta).not.toMatch(/\.\.\.e\b/)
    for (const prohibido of ['registrations', 'checkins', 'volunteers']) {
      expect(ruta, `no debe exponer ${prohibido}`).not.toContain(`${prohibido}:`)
    }
  })

  it('el cupo va como BANDERA, no como número de inscritos', () => {
    expect(ruta).toContain('cupo_lleno')
    // head: true = solo el conteo, sin traer las filas de inscripción.
    expect(ruta).toContain('head: true')
  })

  it('cuenta el cupo con el MISMO criterio que la elegibilidad', () => {
    // Si acá se contara distinto, la página diría "hay lugar" y el sistema
    // rechazaría al inscribirse.
    expect(ruta).toContain("'pending', 'paid', 'exempted'")
    const elig = readFileSync('src/lib/events/eligibility.ts', 'utf8')
    expect(elig).toContain("'pending'")
  })

  it('un evento cancelado o archivado responde 404, no su estado', () => {
    expect(ruta).toContain("e.status === 'cancelled'")
    expect(ruta).toContain("e.status === 'archived'")
  })

  it('tiene límite por IP: es una ruta sin sesión', () => {
    expect(ruta).toContain('rateLimit(')
  })
})
