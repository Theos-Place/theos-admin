/**
 * AYU-3 · Los datos MÍNIMOS para grabar los tres tutoriales de finanzas, y su
 * borrado.
 *
 *   npx tsx scripts/tutoriales/datos-finanzas.ts crear
 *   npx tsx scripts/tutoriales/datos-finanzas.ts borrar
 *
 * Decisión del usuario (2026-09-22): datos mínimos, NO el seed completo. El
 * seed deja grupos con matrícula abierta, eventos, formularios y parejas de
 * prematrimonial en producción hasta que alguien limpie. Acá se crea lo justo,
 * se graba y se borra en la misma sesión.
 *
 * ── LA CUENTA DE FINANZAS, y por qué NO lleva la contraseña compartida ──────
 *
 * Los tres tutoriales que faltan son flujos internos y ninguno de los usuarios
 * `[prueba]` existentes tiene el rol. Hay que crear uno, y el rol `finanzas`
 * no es cualquier cosa: puede registrar devoluciones, aprobar pagos y ver el
 * padrón completo.
 *
 * Por eso esta cuenta se aparta de las otras siete en dos cosas:
 *   · contraseña ALEATORIA por corrida, nunca la compartida del seed —que
 *     estuvo publicada en el centro de ayuda y se decidió no rotar;
 *   · se BORRA al terminar, junto con todo lo demás.
 *
 * O sea que existe los minutos que dura la grabación, con una clave que solo
 * conoce el proceso que la creó.
 *
 * ── LO QUE SE CREA ──────────────────────────────────────────────────────────
 *
 *   · [prueba] Fabiola Finanzas — con rol finanzas, cuenta temporal.
 *   · [prueba] Paco Pagos — el "cliente" de los tres flujos.
 *   · Un grupo [prueba] EN CURSO y una matrícula de Paco en él.
 *   · Un cobro PENDIENTE de ₡60.000 ligado a esa matrícula (para el arreglo).
 *   · Un cobro COBRADO de ₡20.000 (para la devolución).
 *
 * EL GRUPO NO ES VISIBLE PARA NADIE. Va con estado `en_curso`, no
 * `en_matricula`, así que no aparece en el portal: es un grupo empezado y la
 * matrícula de Paco se inserta directo. Esa es la diferencia con el tutorial
 * de la beca, donde el grupo SÍ tenía que estar abierto.
 *
 * Y EL COBRO TIENE QUE COLGAR DE LA MATRÍCULA. Un cobro suelto no se puede
 * partir en tractos: `createPaymentPlan` responde "el pago no está ligado a
 * una matrícula ni a una inscripción". Con `concept: 'folletos'` y sin
 * enrollment la grabación llegaba hasta el final y fallaba en el último clic.
 */
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

for (const f of ['.env', '.env.local']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sin archivo */ }
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) { console.error('Faltan las variables de Supabase'); process.exit(1) }
const sb: SupabaseClient = createClient(URL_, KEY, { auth: { persistSession: false } })

const MARCA = '[prueba]'
export const FINANZAS = 'fabiola.finanzas@prueba.theosplace.invalid'
export const CLIENTE = 'paco.pagos@prueba.theosplace.invalid'
const EXT_FINANZAS = 'PRUEBA-TUTORIAL-FINANZAS'
const EXT_CLIENTE = 'PRUEBA-TUTORIAL-CLIENTE'
const NOTA = '[prueba] tutorial de finanzas'
const GRUPO = '[prueba] Grupo del tutorial de finanzas'
/** Dónde queda la clave de la corrida, para que el runner la lea. */
export const ARCHIVO_CLAVE = 'scripts/tutoriales/out/.clave-finanzas'

for (const correo of [FINANZAS, CLIENTE]) {
  if (!correo.includes('@prueba.')) { console.error(`GUARD: ${correo} no es de prueba`); process.exit(1) }
}

async function planId(code: string): Promise<string> {
  const { data } = await sb.from('study_plans').select('id').eq('code', code).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error(`No existe el plan ${code}`)
  return id
}

async function fichaPorCorreo(correo: string) {
  const { data } = await sb.from('members').select('id, external_id').eq('email', correo).maybeSingle()
  return data as { id: string; external_id: string | null } | null
}

async function crear() {
  const { writeFileSync, mkdirSync } = await import('node:fs')

  // ── El cliente: una ficha cualquiera a nombre de la cual van los cobros ────
  let cliente = await fichaPorCorreo(CLIENTE)
  if (!cliente) {
    const { data, error } = await sb.from('members').insert({
      first_name: `${MARCA} Paco`, last_name: 'Pagos', email: CLIENTE,
      // CON cédula a propósito: sin ella el AppShell levanta el modal
      // "falta tu cédula" encima de todo y se come los clics de la grabación.
      // Las 9001/9005/9010/9011 ya están tomadas por fichas [prueba] viejas.
      cedula: '9-9999-9020', document_type: 'cedula',
      birth_date: '1988-03-12', gender: 'M', is_active: true, external_id: EXT_CLIENTE,
    }).select('id, external_id').single()
    if (error) throw error
    cliente = data as { id: string; external_id: string | null }
    console.log('· ficha del cliente creada')
  } else {
    console.log('· ficha del cliente ya existía')
  }

  // ── La de finanzas ────────────────────────────────────────────────────────
  let fin = await fichaPorCorreo(FINANZAS)
  if (!fin) {
    const { data, error } = await sb.from('members').insert({
      first_name: `${MARCA} Fabiola`, last_name: 'Finanzas', email: FINANZAS,
      cedula: '9-9999-9021', document_type: 'cedula',
      birth_date: '1985-07-04', gender: 'F', is_active: true, external_id: EXT_FINANZAS,
    }).select('id, external_id').single()
    if (error) throw error
    fin = data as { id: string; external_id: string | null }
    console.log('· ficha de finanzas creada')
  }

  // Contraseña aleatoria, distinta en cada corrida. Ver el encabezado.
  const clave = `Tut.${randomBytes(12).toString('base64url')}.9`
  const { data: usuarios } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
  const existente = usuarios?.users.find(u => u.email?.toLowerCase() === FINANZAS)
  let authId = existente?.id
  if (authId) {
    await sb.auth.admin.updateUserById(authId, { password: clave })
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: FINANZAS, password: clave, email_confirm: true,
    })
    if (error) throw error
    authId = data.user.id
  }
  await sb.from('members').update({ auth_user_id: authId }).eq('id', fin.id)

  const { data: yaRol } = await sb.from('member_roles').select('id')
    .eq('member_id', fin.id).eq('role', 'finanzas').maybeSingle()
  if (yaRol) {
    await sb.from('member_roles').update({ is_active: true }).eq('id', (yaRol as { id: string }).id)
  } else {
    const { error } = await sb.from('member_roles')
      .insert({ member_id: fin.id, role: 'finanzas', is_active: true })
    if (error) throw error
  }
  console.log('· cuenta de finanzas lista (clave aleatoria, se borra al terminar)')

  mkdirSync('scripts/tutoriales/out', { recursive: true })
  writeFileSync(ARCHIVO_CLAVE, clave)

  // ── Los dos cobros ────────────────────────────────────────────────────────
  // ── El grupo y la matrícula de los que cuelga el cobro ────────────────────
  const plan = await planId('TRANS')
  let { data: grupo } = await sb.from('study_groups').select('id').eq('name', GRUPO).maybeSingle()
  if (!grupo) {
    const { data, error } = await sb.from('study_groups').insert({
      plan_id: plan, name: GRUPO,
      // EN CURSO, no en matrícula: así NO aparece en el portal de nadie.
      status: 'en_curso', max_students: 20, zone: 'Heredia',
      schedule_days: ['M'], schedule_time: '19:00', location: `${MARCA} Aula del tutorial`,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 60 * 86400000).toISOString(),
    }).select('id').single()
    if (error) throw error
    grupo = data
    console.log('· grupo [prueba] EN CURSO creado (invisible en el portal)')
  }
  const grupoId = (grupo as { id: string }).id

  let { data: matricula } = await sb.from('study_enrollments').select('id')
    .eq('member_id', cliente.id).eq('group_id', grupoId).maybeSingle()
  if (!matricula) {
    const { data, error } = await sb.from('study_enrollments').insert({
      member_id: cliente.id, group_id: grupoId, plan_id: plan,
      status: 'enrolled', enrolled_at: new Date().toISOString(), notes: NOTA,
    }).select('id').single()
    if (error) throw error
    matricula = data
    console.log('· matrícula insertada')
  }
  const matriculaId = (matricula as { id: string }).id

  // `concept` DEBE ir lleno: la COLA DE REVISIÓN filtra con
  // `.not('concept','is',null)` y sin pasar por la cola no hay panel de arreglo.
  const base = {
    member_id: cliente.id, currency: 'CRC', description: NOTA,
    concept: 'matricula', enrollment_id: matriculaId, study_group_id: grupoId,
  }
  const { data: pend } = await sb.from('payments').select('id')
    .eq('member_id', cliente.id).eq('status', 'pending').eq('description', NOTA).maybeSingle()
  if (!pend) {
    const { error } = await sb.from('payments').insert({ ...base, amount: 60000, status: 'pending' })
    if (error) throw error
    console.log('· cobro PENDIENTE de ₡60.000 creado (para el arreglo en tractos)')
  }
  const { data: cob } = await sb.from('payments').select('id')
    .eq('member_id', cliente.id).eq('status', 'paid').eq('description', NOTA).maybeSingle()
  if (!cob) {
    const { error } = await sb.from('payments').insert({
      ...base, amount: 20000, status: 'paid', paid_at: new Date().toISOString(),
    })
    if (error) throw error
    console.log('· cobro COBRADO de ₡20.000 creado (para la devolución)')
  }

  console.log('\nListo. Grabá y después: npx tsx scripts/tutoriales/datos-finanzas.ts borrar')
}

async function borrar() {
  const { rmSync, existsSync } = await import('node:fs')
  for (const [correo, ext] of [[CLIENTE, EXT_CLIENTE], [FINANZAS, EXT_FINANZAS]] as const) {
    const ficha = await fichaPorCorreo(correo)
    if (!ficha) { console.log(`· ${correo}: ya no estaba`); continue }
    if (ficha.external_id !== ext) {
      console.log(`· ${correo}: NO la creó este script (otro external_id), se deja en pie`)
      continue
    }
    // De las hojas al tronco: el sistema no tiene soft-delete y devuelve 409.
    const { data: pagos } = await sb.from('payments').select('id').eq('member_id', ficha.id)
    const pagoIds = ((pagos ?? []) as Array<{ id: string }>).map(p => p.id)
    if (pagoIds.length > 0) {
      await sb.from('refunds').delete().in('payment_id', pagoIds)
      await sb.from('payment_plans').delete().eq('member_id', ficha.id)
      await sb.from('payments').delete().in('id', pagoIds)
      console.log(`  ${pagoIds.length} cobros (y sus devoluciones/arreglos) borrados`)
    }
    await sb.from('study_enrollments').delete().eq('member_id', ficha.id)
    await sb.from('donations').delete().eq('member_id', ficha.id)
    await sb.from('member_roles').delete().eq('member_id', ficha.id)
    const { data: u } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
    const authId = u?.users.find(x => x.email?.toLowerCase() === correo)?.id
    await sb.from('members').update({ auth_user_id: null }).eq('id', ficha.id)
    if (authId) await sb.auth.admin.deleteUser(authId)
    await sb.from('members').delete().eq('id', ficha.id)
    console.log(`· ${correo}: ficha, cuenta y rol borrados`)
  }
  const { data: g } = await sb.from('study_groups').select('id, name').eq('name', GRUPO).maybeSingle()
  if (g) {
    const gr = g as { id: string; name: string }
    if (!gr.name.includes(MARCA)) throw new Error('GUARD: el grupo no lleva la marca')
    await sb.from('study_groups').delete().eq('id', gr.id)
    console.log('· grupo del tutorial borrado')
  }
  if (existsSync(ARCHIVO_CLAVE)) rmSync(ARCHIVO_CLAVE)
  console.log('\nListo, no quedó nada.')
}

// El CLI solo corre si se invoca este archivo directo. Los flujos lo IMPORTAN
// para reusar los correos y la ruta de la clave, y sin este guard el import
// disparaba el parseo de argumentos y mataba la corrida con "Usá: crear|borrar".
const invocadoDirecto = (process.argv[1] ?? '').includes('datos-finanzas')
if (invocadoDirecto) {
  const cmd = process.argv[2]
  if (cmd !== 'crear' && cmd !== 'borrar') { console.error('Usá: crear | borrar'); process.exit(1) }
  ;(cmd === 'crear' ? crear() : borrar()).catch(e => { console.error(e); process.exit(1) })
}
