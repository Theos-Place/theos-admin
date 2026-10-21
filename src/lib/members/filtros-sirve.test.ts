import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TIPOS_SIRVE, esCondicionSirve, tieneCondicionesSirve, patronDeProfesion, resumenDeValores } from './filtros-sirve'
import { ALLOWED_RESTRICTION_TYPES } from '@/lib/audiencia/restriccion'
import { conditionLabel } from '@/lib/condition-labels'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('SRV-20 (4B) · filtros del padrón por el perfil S.I.R.V.E. y profesión', () => {
  it('reconoce las cuatro condiciones del perfil, y la profesión NO es una de ellas', () => {
    for (const t of TIPOS_SIRVE) expect(esCondicionSirve({ type: t })).toBe(true)
    expect(esCondicionSirve({ type: 'profesion' })).toBe(false)
    expect(tieneCondicionesSirve([{ type: 'marital' }, { type: 'sirve_don' }])).toBe(true)
    expect(tieneCondicionesSirve([{ type: 'profesion' }])).toBe(false)
    expect(tieneCondicionesSirve(undefined)).toBe(false)
  })

  it('la profesión busca dentro del texto y neutraliza los comodines', () => {
    expect(patronDeProfesion(' conta ')).toBe('%conta%')
    expect(patronDeProfesion('50%_')).toBe('%50\\%\\_%')
    expect(patronDeProfesion('   ')).toBeNull()
  })

  it('el chip dice qué se marcó', () => {
    expect(conditionLabel({ id: 1, group: 'sirve', type: 'sirve_don', values: ['Fe', 'Enseñanza'] })).toBe('Dones: Fe, Enseñanza')
    expect(conditionLabel({ id: 1, group: 'sirve', type: 'sirve_pasion', values: ['A', 'B', 'C'] })).toBe('Pasiones: 3 seleccionados')
    expect(conditionLabel({ id: 1, group: 'profesion', type: 'profesion', text: 'conta', negate: true })).toBe('Excepto — Profesión: conta')
    expect(conditionLabel({ id: 1, group: 'sirve', type: 'sirve_otros', text: 'apicultura' })).toBe('Otros (texto): apicultura')
    expect(resumenDeValores([])).toBe('ninguno')
  })

  it('NO entran como audiencia de grupos ni formularios: esa lista es un permiso', () => {
    for (const t of [...TIPOS_SIRVE, 'profesion']) expect(ALLOWED_RESTRICTION_TYPES as readonly string[]).not.toContain(t)
  })

  it('las tres rutas que evalúan condiciones cierran la puerta con 403, no saneando', () => {
    for (const r of ['src/app/api/members/route.ts', 'src/app/api/members/ids/route.ts', 'src/app/api/members/export/route.ts']) {
      const src = sinComentarios(r)
      expect(src, r).toContain('tieneCondicionesSirve(conditions) && !puedeLeerSirve(auth.ctx?.roles)')
      expect(src, r).toContain("{ status: 403 }")
    }
  })

  it('el servidor resuelve dones en las DOS columnas y estilo en primario y secundario', () => {
    const src = sinComentarios('src/lib/supabase/queries/members.ts')
    for (const t of TIPOS_SIRVE) expect(src).toContain(`case '${t}':`)
    expect(src).toContain("sirve_don: [{ col: 'dones_test', modo: 'ov' }, { col: 'dones_oracion', modo: 'ov' }]")
    expect(src).toContain("sirve_estilo: [{ col: 'estilo_primario', modo: 'in' }, { col: 'estilo_secundario', modo: 'in' }]")
    expect(src).toContain("q.ilike('occupation', patron)")
    expect(src).toContain("['otros_dones', 'otras_habilidades', 'otras_pasiones']")
  })

  it('la pantalla esconde el bloque a quien no lee el perfil, y el cliente no re-filtra', () => {
    const ui = sinComentarios('src/components/members/AdvancedFilters.tsx')
    expect(ui).toContain('leeSirve = puedeLeerSirve(')
    for (const t of TIPOS_SIRVE) expect(ui).toContain(`leeSirve && permite('${t}')`)
    expect(ui).toContain('...(leeSirve ? TIPOS_SIRVE.filter(permite) : [])')
    const hook = sinComentarios('src/hooks/useMemberFilters.ts')
    expect(hook).toMatch(/case 'sirve_estilo':\s*case 'sirve_otros':\s*case 'profesion': return true/)
  })
})
