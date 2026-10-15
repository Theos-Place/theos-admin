import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * QA-3/N3 (2026-10-15) · El reporte de Análisis de demanda paginaba las
 * ~37.000 matrículas de toda la historia por cada estudio. Ahora trae solo las
 * de los planes que el cálculo usa. La equivalencia se midió contra la versión
 * vieja en prod (42 de 42 estudios iguales, 452 s → 117 s); esto fija las
 * piezas que la sostienen para que nadie las «simplifique».
 */
const SRC = readFileSync('src/lib/supabase/queries/studies-demand.ts', 'utf8')
const i = SRC.indexOf('export async function getStudyDemand')
const FN = SRC.slice(i)

describe('getStudyDemand: qué matrículas trae', () => {
  it('filtra por los planes que importan: el estudio, su requisito y los que siguen', () => {
    expect(FN).toContain('const codigosQueImportan = [...new Set([studyCode, ...(prereq ? [prereq] : []), ...descendants])]')
  })

  it('es la UNIÓN por plan propio y por plan del grupo, no una sola de las dos', () => {
    // En 77 matrículas el plan propio y el del grupo no coinciden: filtrar por
    // uno solo cambiaba resultados.
    expect(FN).toContain("traer(q => q.in('plan_id', planIds))")
    expect(FN).toContain("traer(q => q.in('group_id', tanda))")
  })

  it('los ids de grupo van en tandas, que miles no caben en la URL', () => {
    expect(FN).toMatch(/grupoIds\.slice\(i, i \+ 200\)/)
  })

  it('ordena por id como la consulta vieja: gana la última matrícula del requisito', () => {
    expect(FN).toContain('[...porId.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))')
  })

  it('el empate entre zonas se resuelve por nombre, no por orden de llegada', () => {
    expect(FN).toContain("|| a.zone.localeCompare(b.zone, 'es')")
  })
})
