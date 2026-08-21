/**
 * FLUJO 5 · Mis pagos: pagar y subir comprobante (Pablo Pago Pendiente).
 * REPETIBLE: el setup devuelve el pago del seed a 'pending' sin comprobante.
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { credenciales, htmlToPng, type TutorialFlow, type Tools } from './lib'

credenciales() // guard @prueba. (las credenciales de Pablo van en duro abajo)
const PABLO = 'pablo.pago.pendiente@prueba.theosplace.invalid'
const PASSWORD = 'Prueba.Agosto.2026' // contraseña única del seed

const COMPROBANTE_PATH = join(resolve(__dirname), 'out', 'comprobante-sinpe-12000.png')
const COMPROBANTE_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#0d5c46;color:#fff;padding:24px 20px}
  .ok{width:64px;height:64px;border-radius:50%;background:#fff;color:#0d5c46;font-size:34px;display:flex;align-items:center;justify-content:center;margin:24px auto 12px}
  h1{font-size:18px;text-align:center;margin:0 0 4px}
  .monto{font-size:34px;font-weight:800;text-align:center;margin:10px 0 22px}
  .fila{display:flex;justify-content:space-between;font-size:13px;padding:10px 0;border-top:1px solid rgba(255,255,255,.25)}
  .fila span:first-child{opacity:.75}
</style></head><body>
  <div class="ok">✓</div>
  <h1>Transferencia SINPE realizada</h1>
  <div class="monto">₡12 000,00</div>
  <div class="fila"><span>Destino</span><span>Theos Place</span></div>
  <div class="fila"><span>Motivo</span><span>Matrícula Nivel 1</span></div>
  <div class="fila"><span>Referencia</span><span>2026082098765</span></div>
  <div class="fila"><span>Estado</span><span>Aplicada</span></div>
</body></html>`

async function pagoDePablo(admin: SupabaseClient): Promise<string> {
  const { data: m } = await admin.from('members').select('id').eq('email', PABLO).maybeSingle()
  if (!m) throw new Error('No existe Pablo Pago Pendiente — corré el seed')
  const { data: p } = await admin.from('payments').select('id')
    .eq('member_id', (m as { id: string }).id).eq('concept', 'matricula').limit(1).maybeSingle()
  if (!p) throw new Error('Pablo no tiene el cobro del seed')
  return (p as { id: string }).id
}

export const flujo: TutorialFlow = {
  slug: 'mis-pagos',
  mdFile: 'mis-pagos.md',
  gifAlt: 'El flujo completo: ver tu cobro, pagar y subir el comprobante',

  async setup(admin) {
    const pagoId = await pagoDePablo(admin)
    await admin.from('payments').update({
      status: 'pending', receipt_path: null, review_status: null,
      sinpe_confirmation: null, rejection_reason: null, reviewed_by: null, reviewed_at: null,
    }).eq('id', pagoId)
    console.log('    (pago del seed devuelto a pendiente, sin comprobante)')
  },

  async run(t: Tools) {
    // 1 · Login que aterriza en Pagos pendientes
    await t.goto('/login?redirect=/mis-pagos')
    await t.fill('input[placeholder*="ejemplo@correo"]', PABLO)
    await t.fill('input[type="password"]', PASSWORD)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/mis-pagos**', { timeout: 30_000 })
    await t.page.getByText(/pagar matrícula|reintentar pago/i).first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1200)
    await t.shot('01-mis-pagos')

    // 2-3 · El cobro y su botón de pagar
    await t.badge(2)
    await t.pause(800)
    await t.shot('02-cobro')

    // 4 · Subir comprobante + referencia
    await t.click(t.page.getByRole('button', { name: /pagar matrícula|reintentar pago/i }).first())
    await t.page.locator('#pay-ref').waitFor({ timeout: 15_000 })
    await t.badge(4)
    if (!existsSync(COMPROBANTE_PATH)) await htmlToPng(COMPROBANTE_HTML, COMPROBANTE_PATH)
    await t.pause(600)
    await t.page.locator('input[type="file"]').setInputFiles(COMPROBANTE_PATH)
    await t.fill('#pay-ref', '2026082098765')
    await t.shot('03-comprobante')

    // 5 · Enviar → queda en revisión
    await t.badge(5)
    await t.click(t.page.getByRole('button', { name: 'Enviar comprobante' }))
    await t.page.getByText(/en revisión|revisión/i).first().waitFor({ timeout: 60_000 })
    await t.badge(null)
    await t.pause(1500)
    await t.shot('04-en-revision')
  },

  mdImages: [],
}
