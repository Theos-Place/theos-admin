import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROLES, assignableRoleIds, ACCESOS_SCREEN_ROLES, COORDINADOR_ESTUDIOS_DELEGABLE } from './roles'

describe('assignableRoleIds', () => {
  it('admin reparte todo', () => {
    expect(assignableRoleIds(['admin'])).toBe('all')
  })

  it('gestor_accesos da y quita accesos', () => {
    const r = assignableRoleIds(['gestor_accesos'])
    expect(r).not.toBe('all')
    const set = r as Set<string>
    expect(set.has('dirigente')).toBe(true)
    expect(set.has('finanzas')).toBe(true)
    expect(set.has('gestor_accesos')).toBe(true)
  })

  it('pero NO reparte admin', () => {
    // Poder otorgarse admin a uno mismo vuelve al rol indistinguible de admin,
    // y entonces no habría por qué tenerlo aparte. Es el único que se le niega.
    const set = assignableRoleIds(['gestor_accesos']) as Set<string>
    expect(set.has('admin')).toBe(false)
    expect(set.size).toBe(ROLES.length - 1)
  })

  it('coordinador_estudios sigue con solo lo suyo', () => {
    const set = assignableRoleIds(['coordinador_estudios']) as Set<string>
    expect([...set].sort()).toEqual([...COORDINADOR_ESTUDIOS_DELEGABLE].sort())
  })

  it('sin permiso, nada', () => {
    for (const rol of ['miembro', 'dirigente', 'finanzas', 'direccion'] as const) {
      expect((assignableRoleIds([rol]) as Set<string>).size, rol).toBe(0)
    }
  })
})

describe('quién entra a la pantalla de accesos', () => {
  // La lista estaba escrita a mano en tres lugares. Si vuelve a copiarse, uno
  // de los tres se queda atrás y la pantalla aparece vacía o los datos sin
  // pantalla.
  const fuente = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

  it('los tres lugares usan la MISMA constante', () => {
    for (const f of [
      'src/components/layout/Sidebar.tsx',
      'src/app/api/accesos/route.ts',
      'src/app/api/accesos/[memberId]/roles/route.ts',
    ]) {
      expect(fuente(f), f).toContain('ACCESOS_SCREEN_ROLES')
      expect(fuente(f), f).not.toContain("'admin', 'coordinador_estudios'")
    }
  })

  it('quien puede repartir accesos puede entrar a la pantalla', () => {
    // Lo contrario es un permiso que no se puede usar.
    for (const rol of ROLES.map(r => r.id)) {
      const puedeRepartir = assignableRoleIds([rol]) === 'all' || (assignableRoleIds([rol]) as Set<string>).size > 0
      if (puedeRepartir) expect(ACCESOS_SCREEN_ROLES, rol).toContain(rol)
    }
  })
})
