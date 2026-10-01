import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * El reporte de hitos habla de FOLLETOS, no de matriculados.
 *
 * Decía «Conteo definitivo: X folletos» con X = cantidad de personas. Con un
 * folleto por estudiante coincidía; desde EST-14 ya no, y fallaba en las dos
 * direcciones: la mitad para los grupos de N1 y N3 (necesitan el par) y de
 * más para los de N2 y N4 (sus folletos ya se entregaron).
 */
const CRON = readFileSync('src/app/api/cron/folleto-blocks/route.ts', 'utf8')
const BLOQUES = readFileSync('src/lib/supabase/queries/bloques.ts', 'utf8')

const sinComentarios = (src: string) =>
  src.split('\n').filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*')).join('\n')

describe('el conteo', () => {
  it('se expande a folletos antes de sumar', () => {
    const src = sinComentarios(BLOQUES)
    expect(src).toContain('expandirAFolletos(porGrupo')
    expect(src).toContain('const total = totalDeFolletos(detail)')
    expect(src).toContain('const bySede = folletosPorSede(detail)')
  })

  it('NO vuelve a sumar matrículas a mano', () => {
    // El cebo: si alguien reintroduce el sumatorio sobre las filas crudas,
    // vuelve el conteo por personas sin que nada más cambie.
    expect(sinComentarios(BLOQUES)).not.toContain('sedeMap.set(d.sede')
  })

  it('reusa la regla de pares, no la reescribe', () => {
    // Dos copias se separarían el día que cambien los bloques, y la cola de
    // folletos y el conteo de impresión dirían cosas distintas.
    expect(BLOQUES).toContain("from '@/lib/studies/folletos-del-bloque'")
    const mod = readFileSync('src/lib/studies/folletos-del-bloque.ts', 'utf8')
    expect(mod).toContain("import { folletosQuePide } from './corte-de-bloque'")
    expect(sinComentarios(mod)).not.toMatch(/\[\s*'N1'\s*,\s*'N2'\s*\]/)
  })
})

describe('el correo', () => {
  it('la columna es Folleto y no Nivel', () => {
    expect(CRON).toContain('>Folleto</th>')
    expect(CRON).toContain('${d.folleto}')
    expect(CRON).not.toContain('>Nivel</th>')
  })

  it('la columna de la derecha cuenta folletos', () => {
    expect(CRON).toContain('>Folletos</th>')
    expect(CRON).not.toContain('>Matriculados</th>')
  })

  it('el resumen ya no dice «personas matriculadas»', () => {
    // Era la frase que hacía confiar en un número que significaba otra cosa.
    expect(CRON).not.toMatch(/persona\$\{plural/)
    expect(CRON).toContain('folleto${plural ? \'s\' : \'\'} a imprimir')
  })
})
