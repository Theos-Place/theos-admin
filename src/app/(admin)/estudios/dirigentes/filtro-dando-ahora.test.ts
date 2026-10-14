import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const PANTALLA = 'src/app/(admin)/estudios/dirigentes/page.tsx'
const src = readFileSync(PANTALLA, 'utf8')

/**
 * PAR-6 + DIR-15 · El filtro «Dando ahora».
 *
 * La regla se testea en `lib/studies/dirigente-activo.test.ts`. Acá se fija lo
 * que un test de la regla no puede ver: que la PANTALLA la use en vez de
 * reimplementarla.
 *
 * CAMBIÓ EL DISEÑO el 2026-10-14, a pedido de Floriana: «Dando ahora» era un
 * botón suelto al final de la barra, con su propio estado y su propio conteo.
 * Ahora es una opción más del grupo «Grupos», al lado de «Estado», y se
 * combina con el resto. Dos cosas que este archivo afirmaba se revirtieron A
 * PROPÓSITO y quedan dichas para que no se "arreglen" de vuelta:
 *
 *  · El conteo ya NO es sobre todos sino CONTEXTUAL (cuántos quedarían con lo
 *    que ya está elegido). Es justo lo que apaga las opciones que no llevan a
 *    ningún lado, que es la dependencia que se pidió.
 *  · Ya no hay un `soloDando` aparte: tener el mismo filtro en dos lugares es
 *    lo que hizo que esta pantalla mostrara dos conteos distintos ese día.
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

  it('el link con ?dando=1 sigue funcionando', () => {
    // Se lee UNA vez para sembrar la selección; no se mantiene en paralelo.
    expect(src).toContain("useUrlFlag('dando')")
    expect(src).toContain("useState<ClaveDeFiltro[]>(dandoEnUrl ? ['dirigiendo'] : [])")
  })

  it('«Dando ahora» es una opción del filtro, no un botón aparte', () => {
    expect(src).not.toContain('setSoloDando')
    expect(src).toContain("const soloDando = estado.includes('dirigiendo')")
  })

  it('el filtro también manda en el export', () => {
    // El export recibe `filtered`, así que aplica solo. Si alguien lo cambia a
    // `dirigentes`, el archivo saldría con gente que la pantalla no muestra.
    expect(src).toContain('data={filtered as DirigenteExportRow[]}')
    expect(src).toContain('const ids = filtered.map(d => d.member_id)')
  })
})

/**
 * DIR-14 · Los dos conteos que se contradecían.
 *
 * El encabezado decía «210 activos · 375 inactivos» y los chips «Activo 333 ·
 * Inactivo 245». Cada uno medía otra cosa con la misma palabra, y al filtrar
 * por «Activo» salían filas con el badge «Inactivo».
 */
describe('un solo estado en la pantalla', () => {
  it('el encabezado, el badge y el export salen del mismo módulo', () => {
    expect(src).toContain("from '@/lib/leaders/estado-mostrado'")
    expect(src).toContain('resumenDeDirigentes(porEstado)')
    expect(src).toContain('ETIQUETA_MOSTRADA[estadoMostrado(d.estado_admin?.estado_base)]')
  })

  it('NADIE vuelve a usar el `status` derivado para decir «activo»', () => {
    expect(src).not.toMatch(/d\.status === 'activo'/)
  })
})
