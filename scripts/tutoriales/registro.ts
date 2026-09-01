/**
 * FLUJO · Registro público (crear cuenta siendo nuevo).
 *
 * ES EL ÚNICO TUTORIAL QUE CREA UN REGISTRO NUEVO. Los demás usan la cuenta de
 * prueba del seed; este, por definición, tiene que dar de alta a alguien. Por
 * eso:
 *
 *   · usa una identidad de prueba FIJA (cédula + correo .invalid), no una
 *     aleatoria: si una corrida se cae a la mitad, la siguiente encuentra lo
 *     que quedó y lo limpia en el setup;
 *   · el `setup` borra la ficha y su cuenta de Auth ANTES de grabar — si no, la
 *     segunda corrida caería en la rama de "ya tenés cuenta" y grabaría el
 *     tutorial equivocado;
 *   · el `teardown` la vuelve a borrar. La grabación no puede dejar gente
 *     inventada en el padrón.
 *
 * EL CORREO: la dirección es .invalid, así que el provider ni lo intenta (no
 * rebota en SES). El paso de la bandeja se recrea con un HTML, igual que en
 * primera-vez, y el enlace real se genera con la API admin.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminClient, SITE, type TutorialFlow, type Tools } from './lib'

/** Identidad de prueba.
 *
 *  La CÉDULA CAMBIA EN CADA CORRIDA, y no es capricho: el endpoint limita a 3
 *  intentos por documento cada 15 minutos, y una grabación gasta 2 (móvil y
 *  escritorio). Con una cédula fija, la segunda grabación del día chocaba con
 *  el límite, la pantalla mostraba el 429 y el tutorial se caía esperando la
 *  pantalla de éxito. Pasó de verdad la primera vez que se regrabó.
 *
 *  Los dos viewports comparten la misma —se calcula una vez al cargar el
 *  módulo— para que los dos videos muestren exactamente lo mismo.
 *
 *  Por eso la limpieza NO puede buscar por cédula: busca por el nombre marcado
 *  y por el correo, que sí son fijos. */
const SUFIJO = String(Date.now()).slice(-6)
const PRUEBA = {
  nombre: '[prueba] Registro',
  apellidos: 'Nuevo Ingreso',
  cedula: `9${SUFIJO}${SUFIJO.slice(0, 2)}`.slice(0, 9),
  correo: 'registro.nuevo@prueba.theosplace.invalid',
  telefono: '8700 0000',
}

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
      <div class="subj">Definí tu contraseña de Theos Place</div>
      <div class="from">Theos Place &lt;no-reply@theosplace.org&gt; · ahora</div>
    </div>
    <div class="body">
      <p>Hola,</p>
      <p>Tu cuenta de Theos Place ya está creada. Solo falta que definas tu contraseña:</p>
      <a class="btn" href="#">Definir mi contraseña</a>
      <p>El enlace vence y sirve una sola vez, así que usalo apenas te llegue.</p>
    </div>
    <div class="foot">Theos Place · theosplace.org</div>
  </div>
</body></html>`

/** Borra la ficha de prueba y su cuenta de Auth, si quedaron de antes.
 *  Busca por NOMBRE y correo, no por cédula: la cédula cambia en cada corrida
 *  (ver arriba), así que buscar por ella dejaría basura de las anteriores. */
async function limpiar(admin: SupabaseClient): Promise<void> {
  const { data } = await admin.from('members')
    .select('id, auth_user_id')
    .or(`first_name.eq.${PRUEBA.nombre},email.eq.${PRUEBA.correo}`)
  for (const f of (data ?? []) as Array<{ id: string; auth_user_id: string | null }>) {
    await admin.from('members').delete().eq('id', f.id)
    if (f.auth_user_id) await admin.auth.admin.deleteUser(f.auth_user_id).catch(() => {})
  }
}

export const flujo: TutorialFlow = {
  slug: 'registro',
  mdFile: 'crear-mi-cuenta-siendo-nuevo.md',
  gifAlt: 'El flujo completo: registrarte y definir tu contraseña',

  setup: limpiar,
  teardown: limpiar,

  async run(t: Tools) {
    // 1 · La pantalla de ingreso, y el enlace correcto
    await t.goto('/login')
    await t.badge(1)
    await t.shot('01-login')

    await t.click(t.page.getByText('Registrate acá'))
    await t.page.waitForURL('**/registro**')
    await t.badge(2)
    await t.shot('02-registro')

    // 2 · Los datos. El documento es el campo que importa.
    await t.badge(3)
    await t.fill('#reg-nombre', PRUEBA.nombre)
    await t.fill('#reg-apellidos', PRUEBA.apellidos)
    await t.fill('#reg-cedula', PRUEBA.cedula)
    await t.fill('#reg-correo', PRUEBA.correo)
    await t.fill('#reg-tel', PRUEBA.telefono)
    await t.shot('03-datos')

    await t.click(t.page.getByRole('button', { name: 'Crear mi cuenta' }))
    await t.page.getByText(/revisá tu correo/i).first().waitFor({ timeout: 20_000 })
    await t.shot('04-cuenta-creada')

    // 3 · La bandeja (recreación: el correo real no sale a un .invalid)
    await t.insertHtmlAsStep('05-correo', CORREO_HTML, 2.5, 4)

    // 4 · El enlace de verdad, contra la cuenta recién creada
    const admin = adminClient()
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: PRUEBA.correo })
    const tokenHash = data?.properties?.hashed_token
    if (error || !tokenHash) throw new Error(`generateLink falló: ${error?.message}`)

    const page2 = await t.newSegment()
    await page2.goto(`${SITE}/auth/continuar?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`, { waitUntil: 'networkidle' })
    await t.badge(4)
    await t.shot('06-continuar')
    await t.click(page2.getByRole('link', { name: 'Continuar' }))
    await page2.waitForURL('**/nueva-contrasena**', { timeout: 30_000 })
    await page2.getByText('Nueva contraseña').first().waitFor({ timeout: 15_000 })
    await t.pause(1000)
    await t.shot('07-nueva-contrasena')

    const clave = `Registro.${Date.now()}.Ok`
    const pass = page2.locator('input[type="password"]')
    await pass.nth(0).fill(clave)
    await pass.nth(1).fill(clave)
    await t.shot('08-contrasena-escrita')
    await t.click(page2.locator('button[type="submit"]'))
    await page2.getByText(/cambiada exitosamente/i).waitFor({ timeout: 15_000 })
    await t.badge(4)
    await t.shot('09-exito')

    // 5 · Adentro. Se va a /dashboard y el sistema redirige SOLO al perfil,
    //     porque una cuenta recién registrada es 'miembro' y los miembros no
    //     tienen dashboard (landsOnProfile). Antes esto iba a '/perfil', que NO
    //     existe como ruta: el video terminaba en "página no encontrada".
    await t.pause(2000)
    await t.goto('/dashboard')
    await t.badge(null)
    await t.pause(1500)
    await t.shot('10-adentro')
  },

  mdImages: [],
}
