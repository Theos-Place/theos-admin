// El CURRÍCULO (/estudios/plan) es para cualquier sesión.
//
// Qué estudios hay, en qué orden van y qué pide cada etapa es información para
// quien se va a matricular, no gestión. La decisión era del 2026-07-29 pero
// estaba a medio aplicar: el sidebar solo lo mostraba al dirigente y el
// ModuleGuard cerraba la página. Se completó el 2026-08-06.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { canSeeArchivedPlans } from './plan-visibility'

const layout = readFileSync('src/app/(admin)/layout.tsx', 'utf8')
const sidebar = readFileSync('src/components/layout/Sidebar.tsx', 'utf8')

describe('la página se abre para cualquier sesión', () => {
  it('el ModuleGuard tiene la excepción del currículo', () => {
    expect(layout).toContain("if (pathname === '/estudios/plan') return <>{children}</>")
  })

  it('pero SOLO el listado: el detalle es el editor y sigue cerrado', () => {
    // Si la excepción usara startsWith, /estudios/plan/[id] quedaría abierto.
    expect(layout).not.toMatch(/pathname\.startsWith\('\/estudios\/plan'\)/)
  })
})

describe('se puede encontrar en el menú', () => {
  it('la entrada de Estudios se muestra siempre', () => {
    expect(sidebar).toContain("if (m.href === '/estudios') return true")
  })

  it('el ítem del currículo es el mismo para todos los casos', () => {
    // Antes estaba escrito a mano solo en la rama del dirigente.
    expect(sidebar).toContain('const CURRICULO: SubItem =')
    expect((sidebar.match(/CURRICULO,/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('abrir la página no destapa lo que no le toca', () => {
  it('un miembro NO ve los estudios desactivados (EST-11)', () => {
    expect(canSeeArchivedPlans(['miembro'])).toBe(false)
    expect(canSeeArchivedPlans(['dirigente'])).toBe(false)
  })

  it('la página filtra con esa misma regla', () => {
    const page = readFileSync('src/app/(admin)/estudios/plan/page.tsx', 'utf8')
    expect(page).toContain('visiblePlans(')
    // Y sin permisos no se ofrece editar ni entrar al detalle.
    expect(page).toContain('canManage ? () => router.push')
  })
})
