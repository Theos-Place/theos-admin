import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { camposDelFormulario, restriccionDelFormulario, PLAN_QUE_ABRE, TITULO_DEL_FORMULARIO } from './formulario-perfil-sirve'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

const IDS = { intro: 'i', perfil: 'p', comentarios: 'c' }

describe('SRV-20 · el formulario espejo del perfil S.I.R.V.E.', () => {
  it('lleva el bloque del perfil, sin ser obligatorio (no guarda respuesta)', () => {
    const campos = camposDelFormulario(IDS)
    const bloque = campos.find(c => c.field_type === 'sirve_profile')
    expect(bloque).toBeDefined()
    expect(bloque?.is_required).toBe(false)
    expect(campos.map(c => c.field_type)).toEqual(['info', 'sirve_profile', 'textarea'])
  })

  it('NO tiene audiencia: cualquiera con sesión y el link lo llena (decisión 2026-10-21)', () => {
    expect(PLAN_QUE_ABRE).toBe('SCJ')
    expect(restriccionDelFormulario()).toBeNull()
  })

  it('el seed no escribe textos propios: los toma del módulo', () => {
    const seed = readFileSync('scripts/srv20/sembrar-formulario-perfil-sirve.ts', 'utf8')
    expect(seed).toContain("from '../../src/lib/servers/formulario-perfil-sirve'")
    expect(seed).toContain('restriccionDelFormulario()')
    expect(seed).toContain('requires_auth: true')
    expect(seed).not.toContain(TITULO_DEL_FORMULARIO)
  })
})

describe('SRV-20 · el tipo de campo sirve_profile está cableado como leader_availability', () => {
  it('en el tipo, el adapter, el ícono, el export y el constructor', () => {
    for (const f of ['src/types/forms.ts', 'src/lib/forms/adapter.ts', 'src/components/forms/FieldTypeIcon.tsx',
      'src/lib/forms/xlsx-export.ts', 'src/app/(admin)/formularios/_components/FormBuilder.tsx', 'src/components/forms/FormCanvas.tsx']) {
      expect(readFileSync(f, 'utf8'), f).toContain('sirve_profile')
    }
  })

  it('en el formulario pinta el MISMO componente del perfil, en modo formulario, y no exige respuesta', () => {
    const src = sinComentarios('src/components/forms/FormFiller.tsx')
    expect(src).toMatch(/<PerfilSirve memberId=\{user\.member_id\} modo="formulario" \/>/)
    expect(src).toContain("f.type !== 'sirve_profile' && f.is_required")
    // No en preview ni respondiendo por otra persona: el endpoint solo escribe lo propio.
    const bloque = src.slice(src.indexOf("if (field.type === 'sirve_profile')"), src.indexOf('<PerfilSirve'))
    expect(bloque).toContain('isPreview || onBehalf || !user?.member_id')
  })

  it('la migración lo agrega al CHECK de form_fields', () => {
    const m = readFileSync('supabase/migrations/20261020210000_srv20_campo_perfil_sirve.sql', 'utf8')
    expect(m).toContain("'sirve_profile'")
    expect(m).toContain("'leader_availability'")
  })
})
