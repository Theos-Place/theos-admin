import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const PANTALLA = 'src/app/(admin)/estudios/dirigentes/page.tsx'
const src = readFileSync(PANTALLA, 'utf8')

/**
 * PAR-6 · El filtro «Dando ahora».
 *
 * La regla se testea en `lib/studies/dirigente-activo.test.ts`. Acá se fija lo
 * que un test de la regla no puede ver: que la PANTALLA la use en vez de
 * reimplementarla, y que el nombre no vuelva a chocar.
 */
describe('la pantalla de dirigentes no reimplementa «dando ahora»', () => {
  it('lo pregunta a la definición central', () => {
    expect(src).toContain("from '@/lib/studies/dirigente-activo'")
    expect(src).toContain('dirigeAhora(')
  })

  it('NO compara estados de grupo a mano', () => {
    // El fallo que esto ataja: alguien escribe el `includes` acá, la definición
    // central cambia, y la lista contradice al recálculo mensual sin que nada
    // se rompa. Una sola de estas comparaciones sueltas ya es el bug.
    expect(src).not.toMatch(/===\s*'en_curso'/)
    expect(src).not.toMatch(/'en_matricula'/)
  })

  it('el botón y el desplegable NO se llaman igual', () => {
    // Había dos controles «Dando ahora»: uno preguntaba «¿está dando algo?» y
    // el otro «¿qué está dando?».
    const rotulos = [...src.matchAll(/label="([^"]+)"/g)].map(m => m[1])
    expect(rotulos.filter(r => r === 'Dando ahora')).toHaveLength(0)
    expect(src).toContain('label="Qué está dando"')
  })

  it('el estado vive en la URL, para poder mandar el link filtrado', () => {
    expect(src).toContain("useUrlFlag('dando')")
  })

  it('el botón muestra el conteo', () => {
    expect(src).toContain('Dando ahora · {counts.dando}')
  })

  it('el conteo se calcula sobre TODOS, no sobre lo ya filtrado', () => {
    // Si se calculara sobre `filtered`, el número bajaría al tocar otro filtro
    // y dejaría de contestar la pregunta que su rótulo promete.
    expect(src).toContain('dando: dirigentes.filter(estaDandoAhora).length')
  })

  it('el filtro también manda en el export', () => {
    // El export recibe `filtered`, así que aplica solo. Si alguien lo cambia a
    // `dirigentes`, el archivo saldría con gente que la pantalla no muestra.
    expect(src).toContain('data={filtered as DirigenteExportRow[]}')
    expect(src).toContain('const ids = filtered.map(d => d.member_id)')
  })

  it('es accesible como un toggle y no como un botón cualquiera', () => {
    expect(src).toContain('aria-pressed={soloDando}')
  })
})
