import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'

/**
 * LINT-1 · Las dos formas de arruinar `useCargaRemota`, fijadas en un test.
 *
 * No hay render tests en este repo (vitest corre en `node`), así que se lee el
 * fuente. Es el mismo enfoque de checkin-endpoints.test.ts: lo que se blinda es
 * la DECISIÓN, que es justo lo que alguien cambiaría sin ver el efecto.
 */
const DIR = 'src/hooks'
// Se excluye el propio módulo (su firma contiene el texto que se busca) y los
// tests.
const hooks = readdirSync(DIR)
  .filter(f => f.endsWith('.ts') && !f.includes('.test.') && f !== 'useCargaRemota.ts')

/** El fuente sin comentarios: los comentarios de estos hooks HABLAN del patrón
 *  viejo ("sin setLoading dentro del efecto"), y buscar la palabra a secas los
 *  contaba como infractores. Me pasó escribiendo este test. */
function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

describe('la clave de useCargaRemota es estable', () => {
  /**
   * EL BUG QUE ESTO EVITA. La clave dice cuándo recargar. Si se le pasa un
   * objeto, un array o una plantilla con `?? []`, cambia de identidad en cada
   * render, el efecto vuelve a correr, eso re-renderiza, y la pantalla queda en
   * bucle hasta que el navegador la mata. El propio plan de LINT-1 lo advierte:
   * con un efecto solo se re-disparaba, pero acá tumba la página.
   */
  it('ninguna llamada arranca la clave con un objeto o un array', () => {
    const ofensores: string[] = []
    for (const f of hooks) {
      const texto = sinComentarios(readFileSync(`${DIR}/${f}`, 'utf8'))
      for (const m of texto.matchAll(/useCargaRemota<[^>]*>\(\s*([^,]+),/g)) {
        const clave = m[1].trim()
        if (clave.startsWith('{') || clave.startsWith('[')) ofensores.push(`${f}: ${clave}`)
      }
    }
    expect(ofensores).toEqual([])
  })

  it('todas las claves de hoy son un string o una variable string', () => {
    // Inventario explícito: si aparece una llamada nueva, este test obliga a
    // mirarla en vez de dejarla pasar.
    const claves = new Set<string>()
    for (const f of hooks) {
      const texto = sinComentarios(readFileSync(`${DIR}/${f}`, 'utf8'))
      for (const m of texto.matchAll(/useCargaRemota<[^>]*>\(\s*([^,]+),/g)) claves.add(m[1].trim())
    }
    expect([...claves].sort()).toEqual([
      "'employees'", "'event-types'", "'forms'", "'plans'", 'id ?? \'\'', 'wantedKey',
    ])
  })
})

describe('el contrato de useCargaRemota', () => {
  const fuente = readFileSync(`${DIR}/useCargaRemota.ts`, 'utf8')

  it('NO hay setState síncrono en el efecto: es el punto de todo esto', () => {
    // Lo que se busca es que los setGuardado vivan dentro de .then/.catch.
    const efecto = fuente.slice(fuente.indexOf('useEffect(() => {\n    let vivo'))
    const cuerpo = efecto.slice(0, efecto.indexOf('return () => { vivo = false }'))
    for (const linea of cuerpo.split('\n')) {
      const t = linea.trim()
      if (t.startsWith('setGuardado')) throw new Error(`setState síncrono en el efecto: ${t}`)
    }
    expect(cuerpo).toContain('.then(')
  })

  it('recargar devuelve una promesa: hay pantallas que la esperan antes de navegar', () => {
    // `await refetch()` y después `router.push(...)`: si recargar no se puede
    // esperar, se navega antes de que lleguen los datos.
    expect(fuente).toContain('recargar: () => Promise<void>')
    expect(fuente).toContain('new Promise<void>')
  })
})

describe('los hooks migrados no reintrodujeron el patrón viejo', () => {
  const MIGRADOS = [
    'useForms.ts', 'useEmployees.ts', 'useCommunications.ts', 'useStudyPlans.ts',
    'useGroup.ts', 'useEventTypes.ts', 'useMember.ts', 'useFinance.ts',
    'useServers.ts', 'useStudies.ts',
  ]

  it('ninguno vuelve a tener setLoading', () => {
    const ofensores = MIGRADOS.filter(f => sinComentarios(readFileSync(`${DIR}/${f}`, 'utf8')).includes('setLoading'))
    expect(ofensores).toEqual([])
  })

  it('y todos devuelven `loading`, que es lo que espera cada pantalla', () => {
    // El nombre del campo NO cambió a propósito: renombrarlo habría obligado a
    // tocar decenas de pantallas para nada.
    for (const f of MIGRADOS) {
      if (f === 'useEventTypes.ts') continue // devuelve la lista pelada
      expect(readFileSync(`${DIR}/${f}`, 'utf8'), f).toMatch(/loading: cargando|loading: !!id && cargando/)
    }
  })
})
