// El PLAN DE ESTUDIOS (/estudios/plan) es el currículo: qué estudios existen, en
// qué orden y qué pide cada etapa. Es información para quien se va a matricular,
// no gestión, así que tiene que estar disponible para TODOS los tipos de usuario.
//
// Dos capas y las dos importan:
//   · la PÁGINA — el guard del layout la deja pasar sin mirar el módulo;
//   · el MENÚ — el ítem tiene que aparecer en todas las ramas del submenú.
//
// El hueco que esto cierra (2026-08-25): el rol acotado 'editor_grupos_estudio'
// tenía la página abierta pero NO el enlace. Podía llegar escribiendo la URL, que
// no es una forma de descubrir nada.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { studyGroupsOnlyAllows } from './studies-scope'

const LAYOUT = readFileSync('src/app/(admin)/layout.tsx', 'utf8')
const SIDEBAR = readFileSync('src/components/layout/Sidebar.tsx', 'utf8')
const PLAN = '/estudios/plan'

describe('la página del currículo está abierta', () => {
  it('el guard la deja pasar antes de cualquier chequeo de módulo o de rol', () => {
    const excepcion = LAYOUT.indexOf(`pathname === '${PLAN}'`)
    expect(excepcion, 'falta la excepción del currículo').toBeGreaterThan(-1)
    // Tiene que estar antes del chequeo de módulo Y antes del bloqueo del rol
    // acotado de grupos; si queda después de cualquiera de los dos, no sirve.
    expect(excepcion).toBeLessThan(LAYOUT.indexOf("if (!can(MODULE_BY_PREFIX[prefix], 'view'))"))
    expect(excepcion).toBeLessThan(LAYOUT.indexOf('isStudyGroupsOnly(user.roles'))
  })

  // studyGroupsOnlyAllows NO incluye el plan, y está bien: el early return de
  // arriba lo resuelve antes. Se deja asertado para que quede claro por qué.
  it('el rol acotado de grupos llega al plan por el early return, no por esta lista', () => {
    expect(studyGroupsOnlyAllows(PLAN)).toBe(false)
    expect(studyGroupsOnlyAllows('/estudios/grupos')).toBe(true)
  })
})

describe('el menú ofrece el currículo en todas las ramas', () => {
  /** El bloque del ternario que arma el submenú de Estudios. */
  const bloque = SIDEBAR.slice(
    SIDEBAR.indexOf('const estudiosSub: SubItem[]'),
    SIDEBAR.indexOf('// DIR-5'),
  )

  it('la rama del rol acotado de grupos incluye el currículo', () => {
    const primeraRama = bloque.slice(0, bloque.indexOf(': studiesBeyondOwn'))
    expect(primeraRama).toContain('CURRICULO')
  })

  it('las otras dos ramas también', () => {
    // dirigente y "sin rol de estudios": las dos lo listan explícitamente.
    expect([...bloque.matchAll(/CURRICULO/g)].length).toBeGreaterThanOrEqual(3)
  })

  it('la rama de gestión lo trae por ESTUDIOS_SUB', () => {
    // Del inicio de la constante hasta el cierre de su arreglo. No sirve
    // delimitar con la constante "siguiente": SERVIDORES_SUB está ANTES en el
    // archivo, así que la rebanada salía vacía y el test pasaba en falso.
    const desde = SIDEBAR.indexOf('const ESTUDIOS_SUB')
    const sub = SIDEBAR.slice(desde, SIDEBAR.indexOf('\n]', desde))
    expect(sub, 'no se pudo aislar ESTUDIOS_SUB').toContain('SubItem[]')
    expect(sub).toContain(PLAN)
  })

  it('la entrada de Estudios se muestra siempre, sin mirar el módulo', () => {
    // Sin esto el submenú no se alcanza aunque tenga el ítem adentro.
    expect(SIDEBAR).toContain("if (m.href === '/estudios') return true")
  })
})
