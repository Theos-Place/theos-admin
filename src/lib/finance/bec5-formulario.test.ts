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

// ── Puntos 5 y 6 ────────────────────────────────────────────────────────────

const CAMBIAR_GRUPO = 'src/components/finance/CambiarGrupoDeBeca.tsx'
const EP_CAMBIAR_GRUPO = 'src/app/api/finance/requests/[id]/group/route.ts'
const OFRECER_ARREGLO = 'src/components/finance/OfrecerArregloButton.tsx'
const EP_SOLICITUD = 'src/app/api/finance/requests/[id]/route.ts'

describe('BEC-5 punto 5 · cambiar el grupo sin solicitud nueva', () => {
  it('el formulario manda el campo que el endpoint valida', () => {
    // Mismo riesgo que el casi-desastre de arriba: endurecer un lado y dejar
    // el otro atrás da un 400 en cada intento, sin error visible al compilar.
    expect(sinComentarios(EP_CAMBIAR_GRUPO)).toContain('study_group_id: z.string().uuid()')
    expect(sinComentarios(CAMBIAR_GRUPO)).toContain('study_group_id: grupoId')
  })

  it('pega contra la ruta que existe, con PATCH', () => {
    const ui = sinComentarios(CAMBIAR_GRUPO)
    expect(ui).toContain('/api/finance/requests/${requestId}/group')
    expect(ui).toContain("method: 'PATCH'")
    expect(sinComentarios(EP_CAMBIAR_GRUPO)).toContain('export async function PATCH')
  })

  it('los grupos salen de la elegibilidad real, igual que en el formulario', () => {
    const ui = sinComentarios(CAMBIAR_GRUPO)
    expect(ui).toContain('d?.eligibility')
    expect(ui).toContain('available_groups')
    expect(ui).toContain('x.study_code === codigo')
    expect(ui).not.toContain('d?.studies')
  })

  it('el endpoint NO pide rol: es la propia persona quien entra', () => {
    /**
     * Y por eso la pertenencia se verifica leyendo `member_id` de la fila, no
     * un campo del cuerpo. Con `requireRoles('finanzas')` acá, la persona a
     * la que se le llenó el grupo recibiría un 403 en el único lugar donde
     * tiene que actuar.
     */
    const ep = sinComentarios(EP_CAMBIAR_GRUPO)
    expect(ep).toContain('requireRoles()')
    expect(ep).not.toMatch(/requireRoles\('/)
    expect(ep).toContain('NO_ES_SUYA')
  })
})

describe('BEC-5 punto 6 · ofrecer un arreglo NO es rechazar', () => {
  it('la acción del botón es la que el endpoint acepta', () => {
    expect(sinComentarios(OFRECER_ARREGLO)).toContain("action: 'offer_plan'")
    expect(sinComentarios(EP_SOLICITUD)).toContain("action: z.literal('offer_plan')")
  })

  it('manda los tres datos del arreglo con los nombres del esquema', () => {
    const ui = sinComentarios(OFRECER_ARREGLO)
    for (const campo of ['installments:', 'frequency:', 'first_due:']) {
      expect(ui, campo).toContain(campo)
    }
  })

  it('el endpoint resuelve la solicitud, no la rechaza', () => {
    // Es el punto entero: `rejected` dejaría a la persona afuera con un
    // arreglo creado a su nombre.
    const q = sinComentarios('src/lib/supabase/queries/finance-requests.ts')
    expect(q).toMatch(/updateFinanceRequestStatus\(\s*id, 'resolved'/)
    expect(q).not.toMatch(/ofrecerArregloEnLugarDeBeca[\s\S]{0,1800}'rejected'/)
  })

  it('el arreglo se arma por el camino de FIN-8, no por uno nuevo', () => {
    // Un segundo lugar donde crear arreglos sería un segundo lugar donde
    // aplicar los límites de `limites-de-arreglo`, y uno se quedaría atrás.
    const q = sinComentarios('src/lib/supabase/queries/finance-requests.ts')
    expect(q).toContain('createPaymentPlan')
    expect(q).not.toMatch(/from\('payment_plans'\)[\s\S]{0,80}\.insert/)
  })
})
