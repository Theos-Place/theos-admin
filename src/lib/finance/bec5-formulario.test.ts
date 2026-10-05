import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import type { EligibilityResult, EligibleGroup } from '@/lib/studies/eligibility'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const MODAL = 'src/components/finance/ScholarshipRequestModal.tsx'
const ENDPOINT = 'src/app/api/finance/requests/route.ts'

describe('BEC-5 · el formulario manda lo que el endpoint exige', () => {
  it('manda la razón y el grupo: sin esto el endpoint responde 400', () => {
    /**
     * EL CASI-DESASTRE (2026-10-06). El endpoint se endureció primero —exige
     * `reason_category` y, para estudios, `study_group_id`— y el formulario
     * todavía no los mandaba. Subir eso a producción habría roto TODAS las
     * solicitudes de beca: cada envío con 400 y nadie podría pedir una.
     * Lo agarró una revisión antes de empujar, no un test. Este es el test.
     */
    const modal = sinComentarios(MODAL)
    const endpoint = sinComentarios(ENDPOINT)
    // Lo que el endpoint exige…
    expect(endpoint).toContain('esRazonDeBeca(body.reason_category)')
    expect(endpoint).toMatch(/entityType === 'study_plan' && !body\.study_group_id/)
    // …el formulario lo manda.
    expect(modal).toMatch(/reason_category: razon/)
    expect(modal).toMatch(/study_group_id: entityType === 'study_plan' \? grupoId : null/)
  })

  it('y no deja enviar sin ellos, para no chocar contra el 400', () => {
    const modal = sinComentarios(MODAL)
    expect(modal).toMatch(/if \(!razon\)/)
    expect(modal).toMatch(/if \(entityType === 'study_plan' && !grupoId\)/)
  })

  it('el monto viaja por el mismo módulo que lo valida', () => {
    expect(sinComentarios(MODAL)).toContain('amount: montoPedido(monto)')
  })

  it('el aviso del cupo está a la vista antes de enviar', () => {
    expect(sinComentarios(MODAL)).toContain('AVISO_DE_CUPO')
  })
})

describe('BEC-5 · los grupos salen de la elegibilidad real', () => {
  it('la respuesta se lee con los nombres QUE EXISTEN', () => {
    /**
     * Mi primera versión leía `d.studies[].groups` y buscaba por `plan_id`.
     * El endpoint devuelve `eligibility[].available_groups` y la llave es
     * `study_code`. Habría compilado igual y el selector habría dicho
     * «no hay grupos» siempre, sin error en ningún lado.
     */
    const modal = sinComentarios(MODAL)
    expect(modal).toContain('d?.eligibility')
    expect(modal).toContain('available_groups')
    expect(modal).toContain('x.study_code === codigoDelPlan')
    expect(modal).not.toContain('d?.studies')
  })

  it('y los nombres son los del tipo, no una copia que puede envejecer', () => {
    // Si `EligibilityResult` cambia, esto deja de compilar.
    const campos: Array<keyof EligibilityResult> = ['study_code', 'available_groups']
    expect(campos).toEqual(['study_code', 'available_groups'])
    const delGrupo: Array<keyof EligibleGroup> = ['group_id', 'spots_available', 'leader_name']
    expect(delGrupo).toHaveLength(3)
  })

  it('el plan_id se traduce a código: la elegibilidad no conoce el uuid', () => {
    expect(sinComentarios(MODAL)).toMatch(/studyTypes\.find\(p => p\.plan_id === planId\)\?\.code/)
  })
})
