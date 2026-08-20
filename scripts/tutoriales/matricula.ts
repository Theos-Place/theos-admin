/**
 * FLUJO B · Matrícula (Daniel Intermedio → grupo DIS1 [prueba]).
 *
 * REPETIBLE: antes de grabar se deshace la matrícula de la corrida anterior
 * (matrícula + su pago) vía service role. Sin esto, la segunda corrida graba
 * "ya estás matriculado" en vez del flujo.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { credenciales, type TutorialFlow, type Tools } from './lib'

const { email, password } = credenciales()

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
    await t.shot('01-login')
    await t.fill('input[placeholder*="ejemplo@correo"]', email)
    await t.fill('input[type="password"]', password)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/matricula**', { timeout: 30_000 })
    // Esperar el contenido REAL (hay un flash de carga sin datos del miembro).
    await t.page.getByText('PORTAL DE MATRÍCULA').first().waitFor({ timeout: 30_000 })
    await t.page.getByText('Ver grupos y matricular').first().waitFor({ timeout: 30_000 })
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
    await t.pause(600)
    await t.shot('03-grupo')

    // 4 · Matricular en el grupo [prueba] y confirmar
    await t.click(t.page.getByRole('button', { name: 'Matricular', exact: true }))
    await t.page.getByText('Confirmar matrícula').first().waitFor()
    await t.shot('04-confirmar')
    await t.click(t.page.getByRole('button', { name: /confirmar matrícula/i }))

    // 5 · Pantalla de pago/confirmación. DIS1 tiene costo, así que en vez de
    // navegar aparece el modal "Pagar matrícula": la matrícula YA quedó hecha
    // y ahí mismo se pide el comprobante (es exactamente el paso 5 de la guía).
    await t.page.getByText('Pagar matrícula').first().waitFor({ timeout: 60_000 })
    await t.pause(1200)
    await t.shot('05-confirmacion')
  },

  mdImages: [
    { shot: '02-matricula', alt: 'La pantalla de matrícula con tus estudios disponibles', anchor: 'Entrá al sistema y andá a **Matrícula**' },
    { shot: '03-grupo', alt: 'Los grupos abiertos del estudio, con día, hora y zona', anchor: 'Elegí el estudio' },
    { shot: '04-confirmar', alt: 'La confirmación con el detalle del grupo y el costo', anchor: 'Confirmá. Si el estudio tiene costo' },
    { shot: '05-confirmacion', alt: 'Listo: quedaste matriculado', anchor: 'ya quedaste matriculado' },
  ],
}
