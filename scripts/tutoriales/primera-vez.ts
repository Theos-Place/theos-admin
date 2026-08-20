/**
 * FLUJO A · Primera vez / crear contraseña.
 * Es el tutorial que va linkeado en los correos de invitación (público).
 *
 * EL TRUCO DEL CORREO: el usuario de prueba tiene correo .invalid — no recibe
 * nada. El paso de "enviar el enlace" se intercepta en red (no se dispara el
 * correo real de Supabase, que rebotaría), el enlace se genera directo con la
 * API admin (generateLink type 'recovery') y entre ambas pantallas se inserta
 * una imagen del correo (recreación del template) para que el tutorial no
 * salte el paso de la bandeja.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { credenciales, adminClient, SITE, type TutorialFlow, type Tools } from './lib'

const { email, password } = credenciales()

/** Recreación del correo de recuperación (vista de bandeja en el teléfono).
 *  El correo real lo manda Supabase con su plantilla; esto es la versión
 *  visual para el tutorial. */
const CORREO_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#f4f4f0}
  .bar{background:#161440;color:#fff;padding:14px 16px;font-size:15px;font-weight:600}
  .mail{background:#fff;margin:12px;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .head{padding:14px 16px;border-bottom:1px solid #eee}
  .subj{font-size:16px;font-weight:700;color:#161440}
  .from{font-size:13px;color:#666;margin-top:4px}
  .body{padding:20px 16px;font-size:14px;color:#333;line-height:1.6}
  .btn{display:block;margin:18px auto;background:#EF5554;color:#fff;text-decoration:none;
       text-align:center;padding:13px 18px;border-radius:24px;font-weight:600;max-width:260px}
  .foot{font-size:12px;color:#999;padding:0 16px 18px;text-align:center}
</style></head><body>
  <div class="bar">📥 Bandeja de entrada</div>
  <div class="mail">
    <div class="head">
      <div class="subj">Creá tu contraseña</div>
      <div class="from">Theos Place &lt;no-reply@theosplace.org&gt; · ahora</div>
    </div>
    <div class="body">
      <p>Hola,</p>
      <p>Pediste crear (o restablecer) tu contraseña en el sistema de Theos Place.
      Tocá el botón para definirla:</p>
      <a class="btn" href="#">Crear mi contraseña</a>
      <p>El enlace vence a las dos horas y sirve una sola vez. Si no fuiste vos,
      podés ignorar este correo.</p>
    </div>
    <div class="foot">Theos Place · theosplace.org</div>
  </div>
</body></html>`

async function authUserId(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from('members').select('auth_user_id').eq('email', email).maybeSingle()
  const id = (data as { auth_user_id: string | null } | null)?.auth_user_id
  if (!id) throw new Error(`El usuario de prueba ${email} no tiene cuenta enlazada`)
  return id
}

export const flujo: TutorialFlow = {
  slug: 'primera-vez',
  mdFile: 'entrar-al-sistema-por-primera-vez.md',
  gifAlt: 'El flujo completo: crear tu contraseña y entrar al sistema',

  async run(t: Tools) {
    // El clic de "enviarme el enlace" NO debe disparar el correo real de
    // Supabase (rebotaría en el dominio .invalid): se intercepta y se responde
    // OK, así la pantalla de "revisá tu correo" aparece igual.
    await t.page.route('**/auth/v1/recover*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

    // 1 · Login
    await t.goto('/login')
    await t.badge(1) // paso 1 de la guía: entrá a admin.theosplace.org
    await t.shot('01-login')

    // 2 · "Creá tu contraseña acá"
    await t.click(t.page.getByText('Creá tu contraseña acá'))
    await t.page.waitForURL('**/recuperar**')
    await t.badge(2) // paso 2: "Creá tu contraseña acá"
    await t.shot('02-crear-contrasena')

    // 3 · Ingresar el correo y enviar
    await t.badge(3) // paso 3: escribí tu correo y tocá enviar
    await t.fill('input[type="email"], input[placeholder*="theosplace"]', email)
    await t.shot('03-correo-ingresado')
    await t.click(t.page.getByRole('button', { name: /enviarme el enlace|enviar instrucciones/i }))
    await t.page.getByText(/revisá/i).first().waitFor()
    await t.shot('04-revisa-tu-correo')

    // 5 · El correo en la bandeja (recreación del template; el miembro SÍ pasa por acá)
    await t.insertHtmlAsStep('05-correo', CORREO_HTML, 2.5, 4) // paso 4: abrí el enlace del correo

    // 6 · Abrir el enlace del correo. Se genera con la API admin y se navega a
    // la MISMA pantalla intermedia del correo real (/auth/continuar con el
    // token_hash — la que existe para que Safe Links no gaste el token).
    const admin = adminClient()
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
    const tokenHash = data?.properties?.hashed_token
    if (error || !tokenHash) throw new Error(`generateLink falló: ${error?.message}`)

    const page2 = await t.newSegment()
    await page2.goto(`${SITE}/auth/continuar?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`, { waitUntil: 'networkidle' })
    await t.badge(4)
    await t.shot('06-continuar')
    await t.click(page2.getByRole('link', { name: 'Continuar' }))
    await page2.waitForURL('**/nueva-contrasena**', { timeout: 30_000 })
    await page2.getByText('Nueva contraseña').first().waitFor({ timeout: 15_000 })
    await t.badge(4)
    await t.pause(1000)
    await t.shot('07-nueva-contrasena')

    // 7 · Definir la contraseña. Supabase rechaza repetir la actual, así que
    // se escribe una TEMPORAL; el teardown restaura la del seed al final.
    const temporal = `Tutorial.${Date.now()}.Ok`
    const passInputs = page2.locator('input[type="password"]')
    await t.pause()
    await passInputs.nth(0).fill(temporal)
    await passInputs.nth(1).fill(temporal)
    await t.shot('08-contrasena-escrita')
    await t.click(page2.locator('button[type="submit"]'))
    await page2.getByText(/cambiada exitosamente/i).waitFor({ timeout: 15_000 })
    await t.badge(4)
    await t.shot('09-exito')

    // 8 · Adentro del sistema. El enlace de recuperación deja la sesión
    // iniciada, así que /login suele redirigir directo adentro; si no
    // (sesión cerrada), se inicia sesión con la contraseña recién creada.
    await t.pause(2500)
    await t.goto('/dashboard')
    if (page2.url().includes('/login')) {
      await t.fill('input[placeholder*="ejemplo@correo"]', email)
      await t.fill('input[type="password"]', password)
      await t.click(page2.getByRole('button', { name: 'Iniciar sesión' }))
      await page2.waitForURL(u => !String(u).includes('/login'), { timeout: 30_000 })
    }
    await t.badge(null) // adentro del sistema: sin número, ya no es un paso
    await t.pause(1500)
    await t.shot('10-adentro')
  },

  // Restaurar la contraseña del seed para que la siguiente corrida funcione
  // (en el video se define la MISMA, pero por si el flujo cambia algún día).
  async teardown(admin) {
    const id = await authUserId(admin)
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) console.warn('No se pudo restaurar la contraseña del seed:', error.message)
  },

  // Decisión UX 2026-08-20: en el artículo solo van la infografía + GIF
  // (y el video al final) — las capturas por paso saturaban la página.
  // Quedan en scripts/tutoriales/out/ por si se ocupan.
  mdImages: [],
}
