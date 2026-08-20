/**
 * FLUJO C · Cierre de grupo (vista del DIRIGENTE).
 * Dora Dirigente cierra su grupo Panorama [prueba]: evalúa a los estudiantes,
 * llena un par de recomendaciones a CDEB y confirma el cierre.
 *
 * REPETIBLE: el setup devuelve el grupo a 'en_curso', re-crea las matrículas y
 * borra las recomendaciones de la corrida anterior.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { credenciales, type TutorialFlow, type Tools } from './lib'

// El caso usa a Dora, no al usuario de TUTORIAL_USER_* (que es estudiante).
// El guard general del runner aplica igual; acá además se fija en duro.
const DORA_EMAIL = 'dora.dirigente@prueba.theosplace.invalid'
const { password } = credenciales() // misma contraseña del seed para todas las cuentas [prueba]

const GRUPO = '[prueba] Panorama · Dora Dirigente (cierre)'
const ESTUDIANTES = ['[prueba] Ana', '[prueba] Bruno', '[prueba] Cintia']

async function grupoId(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from('study_groups').select('id').eq('name', GRUPO).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error(`No existe el grupo "${GRUPO}" — crearlo primero (caso de prueba 2026-08-20)`)
  return id
}

export const flujo: TutorialFlow = {
  slug: 'cierre',
  mdFile: 'cierre-de-grupo.md',
  gifAlt: 'El cierre completo: evaluar, recomendar a CDEB y finalizar',

  // Devolver el caso a su estado inicial: grupo en curso, 3 matriculados,
  // sin recomendaciones ni retro pendiente de la corrida anterior.
  async setup(admin) {
    const gid = await grupoId(admin)
    await admin.from('cdeb_recommendations').delete().eq('group_id', gid)
    await admin.from('study_enrollments').delete().eq('group_id', gid)
    const { data: plan } = await admin.from('study_plans').select('id').eq('code', 'PAN').maybeSingle()
    const planId = (plan as { id: string }).id
    const { data: members } = await admin
      .from('members').select('id, first_name').in('first_name', ESTUDIANTES)
    for (const m of (members ?? []) as Array<{ id: string }>) {
      await admin.from('study_enrollments').insert({
        group_id: gid, plan_id: planId, member_id: m.id, status: 'enrolled',
        enrolled_at: '2026-06-09T18:00:00Z',
      })
    }
    await admin.from('study_groups').update({
      status: 'en_curso', feedback_requested_at: null, feedback_released_at: null, feedback_released_by: null,
    }).eq('id', gid)
    console.log('    (grupo devuelto a en_curso con 3 matriculados)')
  },

  async run(t: Tools) {
    const admin = (await import('./lib')).adminClient()
    const gid = await grupoId(admin)

    // 1 · Login como la dirigente → sus grupos
    await t.goto('/login?redirect=/estudios/grupos')
    await t.fill('input[placeholder*="ejemplo@correo"]', DORA_EMAIL)
    await t.fill('input[type="password"]', password)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/estudios/grupos**', { timeout: 30_000 })
    // En móvil las tarjetas muestran el CÓDIGO del plan (PAN) y el dirigente,
    // no el nombre del grupo — se espera el conteo de resultados.
    await t.page.getByText('con estos filtros').first().waitFor({ timeout: 30_000 })
    await t.badge(1) // paso 1: Estudios › Grupos, tus grupos
    await t.pause(1200)
    await t.shot('01-grupos')

    // 2 · Abrir el grupo y tocar "Cierre de estudio"
    await t.goto(`/estudios/grupos/${gid}`)
    await t.page.getByText('Cierre de estudio').first().waitFor({ timeout: 30_000 })
    await t.badge(2)
    await t.pause(800)
    await t.shot('02-grupo')
    await t.click(t.page.getByText('Cierre de estudio'))
    await t.page.waitForURL('**/cierre**', { timeout: 30_000 })
    await t.page.getByText(/aprobado/i).first().waitFor({ timeout: 30_000 })

    // 3 · Evaluar: Ana y Bruno aprobados, Cintia retirada
    await t.badge(3)
    const fila = (nombre: string) => t.page
      .locator('div', { has: t.page.getByText(nombre) })
      .filter({ hasText: /aprobado/i }).last()
    await t.click(fila('[prueba] Ana').getByRole('button', { name: /^aprobado$/i }))
    await t.click(fila('[prueba] Bruno').getByRole('button', { name: /^aprobado$/i }))
    await t.click(fila('[prueba] Cintia').getByRole('button', { name: /^retirado$/i }))
    await t.page.locator('textarea[placeholder*="se mudó de zona"], input[placeholder*="se mudó de zona"]')
      .first().fill('Cambio de horario de trabajo; retoma en el próximo bloque.')
    await t.pause(600)
    await t.shot('03-evaluados')

    // 4 · Recomendaciones a CDEB (una por aprobado)
    await t.badge(4)
    const llenarRecomendacion = async (opts: { recomendacion: RegExp; otroEstudio?: string; shotLleno?: string }) => {
      const modal = t.page.locator('[role="dialog"]')
      await modal.getByText('Convicciones').waitFor({ timeout: 15_000 })
      for (const [grupo, valor] of [['Testimonio', '4'], ['Pasión por enseñar / dar a conocer a Jesús', '5'], ['Conocimiento bíblico', '4'], ['Expresión verbal', '4']] as const) {
        await modal.getByRole('group', { name: grupo }).getByRole('button', { name: valor, exact: true }).click()
      }
      await modal.locator('#cdeb-testimony').fill('Testimonio claro y coherente; comparte cómo Dios ha trabajado en su vida.')
      await modal.locator('#cdeb-passion').fill('Invitó a dos compañeros de trabajo a las charlas por iniciativa propia.')
      await modal.locator('#cdeb-speech').fill('Se expresa con claridad y sabe escuchar al grupo.')
      await modal.locator('#cdeb-committee').fill('Participó todas las semanas y mostró hambre de aprender.')
      await modal.getByRole('button', { name: opts.recomendacion }).click()
      if (opts.otroEstudio) {
        await modal.locator('#cdeb-prior-study').selectOption({ label: opts.otroEstudio })
      }
      if (opts.shotLleno) await t.shot(opts.shotLleno)
      await t.click(modal.getByRole('button', { name: 'Enviar al comité' }))
      await modal.waitFor({ state: 'detached', timeout: 20_000 })
    }

    await t.click(t.page.getByRole('button', { name: /recomendar para cdeb/i }).first())
    await llenarRecomendacion({ recomendacion: /sí, sin reservas/i, shotLleno: '04-recomendacion' })
    await t.pause(600)
    await t.click(t.page.getByRole('button', { name: /recomendar para cdeb/i }).first())
    await llenarRecomendacion({ recomendacion: /otro estudio primero/i, otroEstudio: 'HER — Hermenéutica' })
    await t.pause(600)
    await t.shot('05-recomendaciones-listas')

    // 5 · Continuar al resumen y cerrar el grupo (con su confirmación)
    await t.badge(5)
    await t.click(t.page.getByRole('button', { name: 'Continuar →' }))
    await t.page.getByText('definitiva y no se puede deshacer').first().waitFor({ timeout: 15_000 })
    await t.pause(800)
    await t.click(t.page.getByRole('button', { name: 'Cerrar grupo', exact: true }))
    // El modal exige escribir la palabra "cerrar" para habilitar el botón.
    const confirmModal = t.page.locator('[role="dialog"]')
    await t.pause(600)
    await confirmModal.locator('input').first().fill('cerrar')
    await t.click(confirmModal.getByRole('button', { name: 'Cerrar grupo' }))
    await t.page.getByText(/finalizado/i).first().waitFor({ timeout: 90_000 })
    await t.badge(null)
    await t.pause(1500)
    await t.shot('06-cerrado')
  },

  // El artículo lleva infografía + GIF + video; sin capturas por paso.
  mdImages: [],
}
