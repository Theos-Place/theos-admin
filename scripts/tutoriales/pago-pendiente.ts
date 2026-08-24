/**
 * FLUJO 11 · «Tengo un pago pendiente y no puedo matricularme»
 * (vista del MIEMBRO, no del staff).
 *
 * El caso: Pablo debe la matrícula de un estudio. Entra a matricularse en otro
 * y la pantalla se lo explica en vez de dejarlo intentar y fallar. Después el
 * pago se confirma y el estudio se habilita solo.
 *
 * El video muestra el arco completo —bloqueado, dónde pagar, habilitado—
 * porque la mitad tranquilizadora es justo la que la gente no ve: que no perdió
 * nada y que se destraba solo.
 *
 * REPETIBLE: el setup devuelve el caso a su estado inicial (deuda pendiente de
 * nuevo, sin la matrícula que se hizo en la corrida anterior).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearCuentaDeAcceso } from '../lib/cuentas-de-prueba'
import { credenciales, type TutorialFlow, type Tools } from './lib'

credenciales() // guard @prueba.

const PABLO = 'pablo.pendiente@prueba.theosplace.invalid'
const PASSWORD = 'Prueba.Agosto.2026'
/** El estudio que DEBE (su deuda). Queda exento del bloqueo. */
const PLAN_DEUDA = 'N1'
/** El estudio que quiere llevar: campaña, sin prerequisitos ni compromisos —
 *  así el ÚNICO motivo de bloqueo visible es la deuda, que es lo que enseña. */
const PLAN_META = 'TRANS'
const GRUPO = '[prueba] Transformados · ventana abierta'
const MONTO = 5000

async function idDe(admin: SupabaseClient, email: string): Promise<string> {
  const { data } = await admin.from('members').select('id').eq('email', email).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error(`No existe ${email}`)
  return id
}

async function planId(admin: SupabaseClient, code: string): Promise<string> {
  const { data } = await admin.from('study_plans').select('id').eq('code', code).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error(`No existe el plan ${code}`)
  return id
}

/** El grupo al que se va a matricular: ventana ABIERTA hoy. Se crea acá y no en
 *  el seed porque la ventana tiene que estar viva el día que se grabe. */
async function grupoMeta(admin: SupabaseClient, hoy: string, enUnMes: string): Promise<string> {
  const pid = await planId(admin, PLAN_META)
  const { data: ya } = await admin.from('study_groups').select('id').eq('name', GRUPO).maybeSingle()
  const patch = {
    plan_id: pid, name: GRUPO, status: 'en_matricula',
    enrollment_start_date: hoy, enrollment_end_date: enUnMes,
    starts_at: enUnMes, schedule_time: '19:00', zone: null, max_students: 20,
  }
  if (ya) {
    await admin.from('study_groups').update(patch).eq('id', (ya as { id: string }).id)
    return (ya as { id: string }).id
  }
  const { data, error } = await admin.from('study_groups').insert(patch).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

export const flujo: TutorialFlow = {
  slug: 'pago-pendiente',
  mdFile: 'pago-pendiente-no-puedo-matricularme.md',
  gifAlt: 'Un pago pendiente bloquea la matrícula, y al confirmarlo se habilita sola',
  mdImages: [],

  async setup(admin) {
    await crearCuentaDeAcceso(admin as never, {
      email: PABLO, password: PASSWORD, nombre: '[prueba] Pablo Pendiente',
      camposMiembro: { external_id: 'PRUEBA-9011', gender: 'M', cedula: '9-9999-9011' },
    })
    const pabloId = await idDe(admin, PABLO)

    // Fechas relativas a HOY: la ventana tiene que estar abierta el día que se
    // grabe, no el día que se escribió esto.
    const hoy = new Date()
    const ymd = (d: Date) => d.toISOString().slice(0, 10)
    const enUnMes = new Date(hoy.getTime() + 30 * 86_400_000)
    await grupoMeta(admin, ymd(hoy), ymd(enUnMes))

    // Estado inicial: sin la matrícula de la corrida anterior…
    const metaId = await planId(admin, PLAN_META)
    await admin.from('study_enrollments').delete().eq('member_id', pabloId).eq('plan_id', metaId)

    // …y con su deuda otra vez pendiente. La deuda va LIGADA a una matrícula de
    // N1: así el bloqueo exime a N1 (su propio estudio) y alcanza al resto, que
    // es exactamente la regla que el tutorial explica.
    const deudaId = await planId(admin, PLAN_DEUDA)
    await admin.from('payments').delete().eq('member_id', pabloId).eq('concept', 'matricula')
    await admin.from('study_enrollments').delete().eq('member_id', pabloId).eq('plan_id', deudaId)
    const { data: enr, error: eErr } = await admin.from('study_enrollments')
      .insert({ member_id: pabloId, plan_id: deudaId, status: 'enrolled' })
      .select('id').single()
    if (eErr) throw eErr
    const { error: pErr } = await admin.from('payments').insert({
      member_id: pabloId, amount: MONTO, currency: 'CRC', payment_method: 'comprobante',
      concept: 'matricula', enrollment_id: (enr as { id: string }).id, status: 'pending',
    })
    if (pErr) throw pErr
    console.log('    (deuda de matrícula repuesta y grupo con ventana abierta)')
  },

  async run(t: Tools) {
    const admin = (await import('./lib')).adminClient()
    const pabloId = await idDe(admin, PABLO)

    // 1 · Entra a matricularse y se encuentra el bloqueo explicado
    await t.goto('/login?redirect=/matricula')
    await t.fill('input[placeholder*="ejemplo@correo"]', PABLO)
    await t.fill('input[type="password"]', PASSWORD)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/matricula**', { timeout: 30_000 })
    await t.page.getByText('Te falta un pago').first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1400)
    await t.shot('01-bloqueado')

    // 2 · El estudio que quería, con su motivo y el camino al lado
    await t.badge(2)
    await t.page.getByText('Transformados').first().waitFor({ timeout: 20_000 })
    await t.pause(1000)
    await t.shot('02-estudio-bloqueado')

    // 3 · El botón lleva a sus pagos
    await t.badge(3)
    await t.click(t.page.getByRole('link', { name: /Ir a pagar/i }))
    await t.page.waitForURL('**/mis-pagos**', { timeout: 30_000 })
    await t.pause(1200)
    await t.shot('03-mis-pagos')

    // 4 · Finanzas confirma el pago. En la vida real lo hace una persona del
    // equipo; acá se simula para poder mostrar el "después" en el mismo video.
    await admin.from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('member_id', pabloId).eq('concept', 'matricula').eq('status', 'pending')
    await t.badge(4)
    await t.pause(800)

    // 5 · El estudio quedó habilitado, sin hacer nada más
    await t.goto('/matricula')
    await t.page.getByText('Transformados').first().waitFor({ timeout: 30_000 })
    await t.badge(5)
    await t.pause(1600)
    await t.shot('04-habilitado')
    await t.badge(null)
  },
}
