import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const PASSWORD_LINK = 'src/lib/auth/password-link.ts'

describe('el enlace de la ficha con la cuenta recién creada', () => {
  it('busca la cuenta por SQL, no con auth.admin.listUsers', () => {
    /**
     * EL BUG (producción, 2026-10-05). `listUsers({page:1,perPage:1000})`
     * devuelve las MIL cuentas MÁS VIEJAS y hay 9 025: una cuenta recién
     * creada nunca estaba en esa página, así que la búsqueda fallaba en
     * silencio y la ficha quedaba sin `auth_user_id`.
     *
     * El modo de falla era el peor: la persona definía su contraseña y
     * ENTRABA, pero sin perfil — y al pedir que le crearan el usuario, el
     * correo «ya existía». Cinco personas en una semana, entre ellas Ricardo
     * Martínez Herrera, que fue quien lo reportó.
     */
    const src = sinComentarios(PASSWORD_LINK)
    expect(src).toContain("'buscar_cuenta_por_correo'")
    expect(src).not.toContain('auth.admin.listUsers')
  })

  it('y no hay ningún listUsers paginado a mano en todo el camino de auth', () => {
    // La misma trampa ya había mordido en members/[id]/access-email. Si vuelve
    // a aparecer en este camino, es el mismo bug otra vez.
    for (const ruta of [PASSWORD_LINK, 'src/app/api/members/[id]/access-email/route.ts']) {
      expect(sinComentarios(ruta), ruta).not.toMatch(/listUsers\(\{\s*page:/)
    }
  })

  it('sin cuenta encontrada no se inventa un enlace', () => {
    expect(sinComentarios(PASSWORD_LINK)).toMatch(/if \(!authUserId\) return/)
  })
})
