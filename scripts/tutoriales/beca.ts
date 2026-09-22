/**
 * FLUJO · Me asignaron una beca: dónde aparece y cómo se usa (AYU-3).
 *
 * La pregunta que contesta: «me dieron una beca, ¿y ahora qué hago?». La
 * respuesta es que no hay que hacer nada especial — aparece sola en la pantalla
 * de confirmación de la matrícula, con la casilla YA MARCADA— y eso es
 * justamente lo que cuesta creer sin verlo. De ahí el video.
 *
 * REPETIBLE: el setup deshace la matrícula de la corrida anterior y devuelve la
 * beca a 'active'. Aplicarla la consume (status → used), así que sin esto la
 * segunda corrida grabaría la pantalla sin beca.
 *
 * LOS DATOS LOS PREPARA `datos-beca.ts crear` y los borra `datos-beca.ts
 * borrar`. Van aparte del seed completo a propósito: el grupo queda con
 * matrícula ABIERTA mientras dure la toma, así que se crea, se graba y se
 * borra en la misma sesión. Ese script explica el porqué.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { credenciales, type TutorialFlow, type Tools } from './lib'

const { email, password } = credenciales()

/** 30%: se lee bien en pantalla y deja un resto que pagar, así se ve que el
 *  monto baja y que el flujo de comprobante sigue igual. Una beca del 100%
 *  saltaría el paso del pago y contaría otra historia. */
const NOTA = '[prueba] tutorial de beca'
const GRUPO = '[prueba] Campaña del tutorial de beca'

async function miembroId(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from('members').select('id').eq('email', email).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error(`No existe el miembro de prueba ${email}`)
  return id
}

async function grupoDelTutorial(admin: SupabaseClient): Promise<string> {
  const { data: g } = await admin.from('study_groups').select('id').eq('name', GRUPO).maybeSingle()
  const groupId = (g as { id: string } | null)?.id
  if (!groupId) {
    throw new Error('No existe el grupo del tutorial — corré: npx tsx scripts/tutoriales/datos-beca.ts crear')
  }
  return groupId
}

export const flujo: TutorialFlow = {
  slug: 'beca',
  mdFile: 'me-asignaron-una-beca.md',
  gifAlt: 'Dónde aparece la beca al matricularte: la casilla ya viene marcada y el monto sale con el descuento',

  async setup(admin) {
    const memberId = await miembroId(admin)
    const groupId = await grupoDelTutorial(admin)

    // Deshacer la matrícula de la corrida anterior (y su pago), para que la
    // segunda toma grabe el flujo y no "ya estás matriculado".
    const { data: enrs } = await admin.from('study_enrollments')
      .select('id').eq('member_id', memberId).eq('group_id', groupId)
    const ids = ((enrs ?? []) as Array<{ id: string }>).map(e => e.id)
    if (ids.length > 0) {
      await admin.from('payments').delete().in('enrollment_id', ids)
      await admin.from('study_enrollments').delete().in('id', ids)
      console.log(`    (deshecha la matrícula anterior: ${ids.length})`)
    }

    // Aplicar la beca la CONSUME (status → used), así que se devuelve a activa
    // o la segunda corrida grabaría la pantalla sin beca.
    const { data: beca } = await admin.from('scholarships').select('id')
      .eq('member_id', memberId).eq('notes', NOTA).limit(1).maybeSingle()
    if (!beca) throw new Error('No existe la beca del tutorial — corré datos-beca.ts crear')
    await admin.from('scholarships')
      .update({ status: 'active', is_used: false, used_at: null })
      .eq('id', (beca as { id: string }).id)
  },

  async run(t: Tools) {
    // 1 · Entrar. El ?redirect= aterriza directo en matrícula (AUT-3).
    await t.goto('/login?redirect=/matricula')
    await t.badge(1)
    await t.shot('01-login')
    await t.fill('input[placeholder*="ejemplo@correo"]', email)
    await t.fill('input[type="password"]', password)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/matricula**', { timeout: 30_000 })
    await t.page.getByText('PORTAL DE MATRÍCULA').first().waitFor({ timeout: 30_000 })
    await t.page.getByText('Ver grupos y matricular').first().waitFor({ timeout: 30_000 })
    await t.pause(1200)

    // 2 · Mis pagos primero: ahí se ve la beca ANTES de usarla, que es donde
    // la persona la busca cuando le llega el correo.
    await t.goto('/mis-pagos')
    await t.page.getByText('Mis becas').first().waitFor({ timeout: 30_000 })
    await t.badge(2)
    await t.pause(1000)
    await t.shot('02-mis-becas')

    // 3 · A matricularse.
    await t.goto('/matricula')
    await t.page.getByText('Ver grupos y matricular').first().waitFor({ timeout: 30_000 })
    const card = t.page
      .locator('div', { has: t.page.getByText('TRANS', { exact: true }) })
      .filter({ hasText: 'Ver grupos y matricular' })
      .last()
    await card.scrollIntoViewIfNeeded()
    await t.click(card.getByText('Ver grupos y matricular'))
    await t.pause(600)
    await t.shot('03-grupo')

    // 4 · EL MOMENTO. La casilla «Usar mi beca» ya viene marcada y el monto de
    // abajo es el que va a pagar, con el descuento aplicado.
    await t.click(t.page.getByRole('button', { name: 'Matricular', exact: true }))
    await t.page.getByText('Confirmar matrícula').first().waitFor()
    await t.page.getByText(/Usar mi beca/i).first().waitFor({ timeout: 15_000 })
    await t.badge(3)
    await t.pause(1500)
    await t.shot('04-usar-mi-beca')

    // 5 · Confirmar y ver el cobro ya descontado.
    await t.click(t.page.getByRole('button', { name: /confirmar matrícula/i }))
    await t.page.getByText('Pagar matrícula').first().waitFor({ timeout: 60_000 })
    await t.badge(4)
    await t.pause(1500)
    await t.shot('05-monto-con-descuento')
  },

  mdImages: [],
}
