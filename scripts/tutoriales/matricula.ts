/**
 * FLUJO B · Matrícula (Daniel Intermedio → grupo DIS1 [prueba]).
 *
 * REPETIBLE: antes de grabar se deshace la matrícula de la corrida anterior
 * (matrícula + su pago) vía service role. Sin esto, la segunda corrida graba
 * "ya estás matriculado" en vez del flujo.
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { credenciales, htmlToPng, type TutorialFlow, type Tools } from './lib'

const { email, password } = credenciales()

/** Comprobante SINPE de mentira (para el paso de subirlo). */
const COMPROBANTE_PATH = join(resolve(__dirname), 'out', 'comprobante-sinpe.png')
const COMPROBANTE_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#0d5c46;color:#fff;padding:24px 20px}
  .ok{width:64px;height:64px;border-radius:50%;background:#fff;color:#0d5c46;font-size:34px;
      display:flex;align-items:center;justify-content:center;margin:24px auto 12px}
  h1{font-size:18px;text-align:center;margin:0 0 4px}
  .monto{font-size:34px;font-weight:800;text-align:center;margin:10px 0 22px}
  .fila{display:flex;justify-content:space-between;font-size:13px;padding:10px 0;border-top:1px solid rgba(255,255,255,.25)}
  .fila span:first-child{opacity:.75}
</style></head><body>
  <div class="ok">✓</div>
  <h1>Transferencia SINPE realizada</h1>
  <div class="monto">₡15 000,00</div>
  <div class="fila"><span>Destino</span><span>Theos Place</span></div>
  <div class="fila"><span>Motivo</span><span>Matrícula Discípulos 1</span></div>
  <div class="fila"><span>Referencia</span><span>2026082012345</span></div>
  <div class="fila"><span>Fecha</span><span>20/08/2026 · 10:14 a.m.</span></div>
  <div class="fila"><span>Estado</span><span>Aplicada</span></div>
</body></html>`

async function danielId(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from('members').select('id').eq('email', email).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error(`No existe el miembro de prueba ${email}`)
  return id
}

/** El grupo DIS1 del seed ([prueba] en el nombre). */
async function grupoDis1(admin: SupabaseClient): Promise<string> {
  const { data: plan } = await admin.from('study_plans').select('id').eq('code', 'DIS1').maybeSingle()
  const planId = (plan as { id: string } | null)?.id
  if (!planId) throw new Error('No existe el plan DIS1')
  const { data: g } = await admin
    .from('study_groups').select('id, name').eq('plan_id', planId).ilike('name', '%prueba%').limit(1).maybeSingle()
  const id = (g as { id: string } | null)?.id
  if (!id) throw new Error('No existe un grupo DIS1 [prueba] — corré el seed de datos de prueba')
  return id
}

export const flujo: TutorialFlow = {
  slug: 'matricula',
  mdFile: 'como-me-matriculo.md',
  gifAlt: 'El flujo completo de matrícula, de inicio a fin',

  // Deshacer la corrida anterior (pago + matrícula) y asegurar el prerequisito:
  // DIS1 exige SCJ completado y el seed no se lo daba a Daniel (lo matriculaba
  // directo por BD, saltándose la elegibilidad).
  async setup(admin) {
    const [memberId, groupId] = await Promise.all([danielId(admin), grupoDis1(admin)])
    const { data: enrs } = await admin
      .from('study_enrollments').select('id').eq('member_id', memberId).eq('group_id', groupId)
    const ids = ((enrs ?? []) as Array<{ id: string }>).map(e => e.id)
    if (ids.length > 0) {
      await admin.from('payments').delete().in('enrollment_id', ids)
      await admin.from('study_enrollments').delete().in('id', ids)
      console.log(`    (deshecha la matrícula anterior: ${ids.length})`)
    }

    // Prerequisito SCJ completado (idempotente).
    const { data: scjPlan } = await admin.from('study_plans').select('id').eq('code', 'SCJ').maybeSingle()
    const scjPlanId = (scjPlan as { id: string } | null)?.id
    if (!scjPlanId) throw new Error('No existe el plan SCJ')
    const { data: prev } = await admin
      .from('study_enrollments').select('id').eq('member_id', memberId).eq('plan_id', scjPlanId).eq('status', 'completed').limit(1)
    if (((prev ?? []) as unknown[]).length === 0) {
      const { data: scjGroup } = await admin
        .from('study_groups').select('id').eq('plan_id', scjPlanId).ilike('name', '%prueba%').limit(1).maybeSingle()
      const scjGroupId = (scjGroup as { id: string } | null)?.id
      if (!scjGroupId) throw new Error('No existe un grupo SCJ [prueba]')
      const { error } = await admin.from('study_enrollments').insert({
        member_id: memberId, group_id: scjGroupId, plan_id: scjPlanId,
        status: 'completed', enrolled_at: '2026-03-01T12:00:00Z',
      })
      if (error) throw error
      console.log('    (SCJ completado insertado como prerequisito)')
    }
  },

  async run(t: Tools) {
    // 1 · Login que aterriza directo en /matricula (?redirect= ya funciona)
    await t.goto('/login?redirect=/matricula')
    await t.badge(1) // paso 1 de la guía: entrá al sistema y andá a Matrícula
    await t.shot('01-login')
    await t.fill('input[placeholder*="ejemplo@correo"]', email)
    await t.fill('input[type="password"]', password)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/matricula**', { timeout: 30_000 })
    // Esperar el contenido REAL (hay un flash de carga sin datos del miembro).
    await t.page.getByText('PORTAL DE MATRÍCULA').first().waitFor({ timeout: 30_000 })
    await t.page.getByText('Ver grupos y matricular').first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1200)

    // 2 · La pantalla de matrícula, con las etapas y compromisos en verde
    await t.shot('02-matricula')

    // 3 · Abrir el estudio DIS1 y ver sus grupos
    const cardDis1 = t.page
      .locator('div', { has: t.page.getByText('DIS1', { exact: true }) })
      .filter({ hasText: 'Ver grupos y matricular' })
      .last()
    await cardDis1.scrollIntoViewIfNeeded()
    await t.click(cardDis1.getByText('Ver grupos y matricular'))
    await t.badge(2) // paso 2: elegí el estudio y el grupo
    await t.pause(600)
    await t.shot('03-grupo')

    // 4 · Matricular en el grupo [prueba] y confirmar
    await t.click(t.page.getByRole('button', { name: 'Matricular', exact: true }))
    await t.page.getByText('Confirmar matrícula').first().waitFor()
    await t.badge(3) // paso 3: confirmá
    await t.shot('04-confirmar')
    await t.click(t.page.getByRole('button', { name: /confirmar matrícula/i }))

    // 5 · Pantalla de pago/confirmación. DIS1 tiene costo, así que en vez de
    // navegar aparece el modal "Pagar matrícula": la matrícula YA quedó hecha
    // y ahí mismo se pide el comprobante (es exactamente el paso 5 de la guía).
    await t.page.getByText('Pagar matrícula').first().waitFor({ timeout: 60_000 })
    await t.badge(4) // paso 4: ya quedaste matriculado
    await t.pause(1200)
    await t.shot('05-confirmacion')

    // 6 · Subir el comprobante + número de referencia y enviar.
    if (!existsSync(COMPROBANTE_PATH)) await htmlToPng(COMPROBANTE_HTML, COMPROBANTE_PATH)
    await t.pause()
    await t.badge(5) // paso 5: subí el comprobante
    await t.page.locator('input[type="file"]').setInputFiles(COMPROBANTE_PATH)
    await t.fill('#mat-pay-ref', '2026082012345')
    await t.shot('06-comprobante-listo')
    await t.click(t.page.getByRole('button', { name: 'Enviar comprobante' }))

    // 7 · Enviado: "ya quedaste matriculado, finanzas lo revisa aparte".
    await t.page.getByText('Comprobante enviado').first().waitFor({ timeout: 60_000 })
    await t.pause(1000)
    await t.shot('07-comprobante-enviado')
  },

  // Decisión UX 2026-08-20: en el artículo solo van la infografía + GIF
  // (y el video al final) — las capturas por paso saturaban la página.
  // Quedan en scripts/tutoriales/out/ por si se ocupan.
  mdImages: [],
}
