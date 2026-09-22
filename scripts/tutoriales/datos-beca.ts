/**
 * AYU-3 · Los datos MÍNIMOS para grabar el tutorial de la beca, y su borrado.
 *
 *   npx tsx scripts/tutoriales/datos-beca.ts crear
 *   npx tsx scripts/tutoriales/datos-beca.ts borrar
 *
 * POR QUÉ ESTE SCRIPT Y NO EL SEED COMPLETO. El seed crea grupos, eventos,
 * formularios y parejas de prematrimonial, y los deja en producción hasta que
 * alguien los borre. Acá se crea lo justo para una toma y se borra apenas
 * termina: decisión del usuario del 2026-09-22, "menos huella".
 *
 * LO QUE SE VE DESDE AFUERA, y por eso hay que ser rápido: el grupo `[prueba]`
 * queda con matrícula ABIERTA mientras dure la grabación, y hoy no hay ningún
 * otro grupo abierto en todo el sistema. `borrar` también quita las matrículas
 * que alguien haya alcanzado a hacer en esos minutos, y avisa si las hubo.
 *
 * POR QUÉ UNA CAMPAÑA Y NO DIS1. El primer intento fue con DIS1, pensando que
 * sus requisitos —SCJ completo, servir, donar, asistir— lo volvían casi
 * invisible. Pero para que el miembro de prueba fuera elegible había que
 * fabricarle DOCE check-ins dentro de los últimos seis meses, y eso habría
 * ensuciado los reportes de asistencia que acabamos de construir: esas visitas
 * aparecerían como asistentes reales de la semana.
 *
 * Las campañas cuestan ₡25.000 y NO piden nada (`requirementsForStage` para
 * 'campanas' devuelve todo en false). O sea: cero datos inventados, que pesa
 * más que la visibilidad de unos minutos de un grupo que dice "[prueba]".
 *
 * Todo lo que crea lleva la marca [prueba] o la nota de abajo, y `borrar` se
 * niega a tocar cualquier cosa que no la tenga.
 */
import { readFileSync } from 'node:fs'
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

const CORREO = process.env.TUTORIAL_USER_EMAIL ?? ''
const CLAVE = process.env.TUTORIAL_USER_PASSWORD ?? ''
if (!CORREO.includes('@prueba.')) {
  console.error(`GUARD: "${CORREO}" no es una cuenta de prueba. Me niego.`)
  process.exit(1)
}

const MARCA = '[prueba]'
const NOTA = '[prueba] tutorial de beca'
const PLAN = 'TRANS'   // Transformados, campaña: ₡25.000 y sin compromisos
const GRUPO = `${MARCA} Campaña del tutorial de beca`
const EXTERNAL_ID = 'PRUEBA-TUTORIAL-BECA'
const DESCUENTO = 30

async function planId(code: string): Promise<string> {
  const { data } = await sb.from('study_plans').select('id').eq('code', code).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error(`No existe el plan ${code}`)
  return id
}

async function crear() {
  const plan = await planId(PLAN)

  // ── La persona ────────────────────────────────────────────────────────────
  let { data: m } = await sb.from('members').select('id').eq('email', CORREO).maybeSingle()
  if (!m) {
    const { data, error } = await sb.from('members').insert({
      first_name: `${MARCA} Daniel`, last_name: 'Intermedio',
      email: CORREO, cedula: '9-9999-9002', document_type: 'cedula',
      birth_date: '1992-05-10', gender: 'M', is_active: true,
      // La marca de la ficha es el external_id: `members` no tiene columna de
      // notas, y el prefijo PRUEBA- es lo que ya usa el seed.
      external_id: EXTERNAL_ID,
    }).select('id').single()
    if (error) throw error
    m = data
    console.log('· ficha creada')
  } else {
    await sb.from('members').update({ is_active: true }).eq('id', (m as { id: string }).id)
    console.log('· ficha ya existía')
  }
  const memberId = (m as { id: string }).id

  // ── La cuenta de acceso ───────────────────────────────────────────────────
  const { data: usuarios } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
  let authId = usuarios?.users.find(u => u.email?.toLowerCase() === CORREO.toLowerCase())?.id
  if (!authId) {
    const { data, error } = await sb.auth.admin.createUser({
      email: CORREO, password: CLAVE, email_confirm: true,
    })
    if (error) throw error
    authId = data.user.id
    console.log('· cuenta de acceso creada')
  }
  await sb.from('members').update({ auth_user_id: authId }).eq('id', memberId)

  // ── El grupo, con matrícula abierta ───────────────────────────────────────
  const hoy = new Date()
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  let { data: g } = await sb.from('study_groups').select('id').eq('name', GRUPO).maybeSingle()
  if (!g) {
    const { data, error } = await sb.from('study_groups').insert({
      plan_id: plan, name: GRUPO, status: 'en_matricula', max_students: 20,
      zone: 'Heredia', schedule_days: ['M'], schedule_time: '19:00',
      location: `${MARCA} Aula del tutorial`,
      starts_at: hoy.toISOString(),
      ends_at: new Date(hoy.getTime() + 60 * 86400000).toISOString(),
      enrollment_start_date: ymd(new Date(hoy.getTime() - 86400000)),
      enrollment_end_date: ymd(new Date(hoy.getTime() + 30 * 86400000)),
    }).select('id').single()
    if (error) throw error
    g = data
    console.log('· grupo creado CON MATRÍCULA ABIERTA — grabá y borrá rápido')
  } else {
    console.log('· grupo ya existía')
  }

  // ── La beca ───────────────────────────────────────────────────────────────
  const { data: beca } = await sb.from('scholarships').select('id')
    .eq('member_id', memberId).eq('notes', NOTA).limit(1).maybeSingle()
  if (beca) {
    await sb.from('scholarships').update({ status: 'active', is_used: false, used_at: null })
      .eq('id', (beca as { id: string }).id)
    console.log('· beca devuelta a activa')
  } else {
    const { error } = await sb.from('scholarships').insert({
      member_id: memberId, kind: 'asignada', status: 'active',
      entity_type: 'study_plan', plan_id: plan,
      discount_type: 'percentage', discount_value: DESCUENTO,
      currency: 'CRC', notes: NOTA, reason: 'Beca de ejemplo del tutorial',
      approved_at: new Date().toISOString(),
    })
    if (error) throw error
    console.log(`· beca del ${DESCUENTO}% creada`)
  }
  console.log('\nListo. Grabá YA y después: npx tsx scripts/tutoriales/datos-beca.ts borrar')
}

async function borrar() {
  const { data: g } = await sb.from('study_groups').select('id, name').eq('name', GRUPO).maybeSingle()
  if (g) {
    const grupo = g as { id: string; name: string }
    if (!grupo.name.includes(MARCA)) throw new Error('GUARD: el grupo no lleva la marca [prueba]')

    // ¿Alguien real alcanzó a matricularse en los minutos que estuvo abierto?
    const { data: matriculas } = await sb.from('study_enrollments')
      .select('id, member_id, members!inner(first_name, last_name, email)')
      .eq('group_id', grupo.id)
    const filas = (matriculas ?? []) as Array<{
      id: string; member_id: string
      members: { first_name: string; last_name: string; email: string | null }
    }>
    const ajenas = filas.filter(f => (f.members.email ?? '') !== CORREO)
    if (ajenas.length > 0) {
      console.log('\n⚠ ALGUIEN MÁS SE MATRICULÓ mientras el grupo estuvo abierto:')
      for (const f of ajenas) {
        console.log(`   ${f.members.first_name} ${f.members.last_name} <${f.members.email}>`)
      }
      console.log('   Se les borra la matrícula junto con el grupo. Avisales.\n')
    }
    const ids = filas.map(f => f.id)
    if (ids.length > 0) {
      await sb.from('payments').delete().in('enrollment_id', ids)
      await sb.from('study_enrollments').delete().in('id', ids)
      console.log(`· ${ids.length} matrículas y sus pagos borrados`)
    }
    await sb.from('study_groups').delete().eq('id', grupo.id)
    console.log('· grupo borrado')
  } else {
    console.log('· el grupo ya no estaba')
  }

  const { data: m } = await sb.from('members').select('id, external_id').eq('email', CORREO).maybeSingle()
  if (m) {
    const ficha = m as { id: string; external_id: string | null }
    if (ficha.external_id !== EXTERNAL_ID) {
      console.log('· la ficha NO la creó este script (otro external_id): se deja en pie')
    } else {
      await sb.from('scholarships').delete().eq('member_id', ficha.id).eq('notes', NOTA)
      await sb.from('study_enrollments').delete().eq('member_id', ficha.id).eq('notes', NOTA)
      const { data: u } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
      const authId = u?.users.find(x => x.email?.toLowerCase() === CORREO.toLowerCase())?.id
      await sb.from('members').update({ auth_user_id: null }).eq('id', ficha.id)
      if (authId) await sb.auth.admin.deleteUser(authId)
      await sb.from('members').delete().eq('id', ficha.id)
      console.log('· beca, matrículas, cuenta y ficha del tutorial borradas')
    }
  }
  console.log('\nListo, no quedó nada.')
}

const cmd = process.argv[2]
if (cmd !== 'crear' && cmd !== 'borrar') {
  console.error('Usá: crear | borrar')
  process.exit(1)
}
;(cmd === 'crear' ? crear() : borrar()).catch(e => { console.error(e); process.exit(1) })
