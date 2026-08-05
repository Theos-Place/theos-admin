/**
 * BORRA el set de datos de prueba creado por seed-datos-de-prueba.ts.
 *
 * DRY-RUN POR DEFECTO: sin `--aplicar` solo lista lo que borraría.
 *
 *   npx tsx scripts/limpiar-datos-de-prueba.ts            # solo lista
 *   npx tsx scripts/limpiar-datos-de-prueba.ts --aplicar  # borra de verdad
 *
 * CÓMO IDENTIFICA: members.external_id con prefijo 'PRUEBA-'. De ahí salen los
 * miembros, y de los miembros todo lo demás. Los objetos que no cuelgan de un
 * miembro (grupos, evento, formulario, lista, puesto) se buscan por el marcador
 * "[prueba]" en el nombre.
 *
 * SE NIEGA A CORRER si alguno de los objetos que va a borrar no tiene el
 * marcador: es la red que evita que un external_id mal escrito se lleve por
 * delante a una persona real.
 *
 * ORDEN: el sistema no tiene soft-delete y devuelve 409 con referencias, así que
 * se borra de las hojas al tronco — check-ins, pagos, matrículas, recomendaciones
 * y respuestas primero; después grupos, evento y formulario; los miembros al
 * final, con sus usuarios de Supabase Auth.
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

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false } }) as unknown as SupabaseClient

const APLICAR = process.argv.includes('--aplicar')
const MARCA = '[prueba]'
const PREFIJO = 'PRUEBA-'
const DOMINIO = 'prueba.theosplace.invalid'

type Miembro = { id: string; first_name: string; last_name: string; email: string | null; external_id: string | null; auth_user_id: string | null }

async function main() {
  console.log(`\nLimpieza del set de prueba — ${APLICAR ? 'APLICANDO' : 'DRY-RUN (no borra nada)'}\n`)

  // ── 1. Qué hay ─────────────────────────────────────────────────────────────
  const { data: miembrosRaw, error } = await db.from('members')
    .select('id, first_name, last_name, email, external_id, auth_user_id')
    .like('external_id', `${PREFIJO}%`)
  if (error) throw new Error(error.message)
  const miembros = (miembrosRaw ?? []) as Miembro[]

  const { data: gruposRaw } = await db.from('study_groups').select('id, name').like('name', `%${MARCA}%`)
  const grupos = (gruposRaw ?? []) as Array<{ id: string; name: string }>

  const { data: eventosRaw } = await db.from('events').select('id, title').like('title', `%${MARCA}%`)
  const eventos = (eventosRaw ?? []) as Array<{ id: string; title: string }>

  const { data: formsRaw } = await db.from('forms').select('id, title').like('title', `%${MARCA}%`)
  const forms = (formsRaw ?? []) as Array<{ id: string; title: string }>

  const { data: listasRaw } = await db.from('member_lists').select('id, name').like('name', `%${MARCA}%`)
  const listas = (listasRaw ?? []) as Array<{ id: string; name: string }>

  const { data: puestosRaw } = await db.from('service_positions').select('id, title').like('title', `%${MARCA}%`)
  const puestos = (puestosRaw ?? []) as Array<{ id: string; title: string }>

  if (miembros.length === 0 && grupos.length === 0) {
    console.log('No hay nada marcado como prueba. Nada que hacer.\n')
    return
  }

  // ── 2. Red de seguridad: TODO tiene que estar marcado ──────────────────────
  const sospechosos: string[] = []
  for (const m of miembros) {
    const nombre = `${m.first_name} ${m.last_name}`
    if (!nombre.includes(MARCA)) sospechosos.push(`miembro sin marca en el nombre: ${nombre} (${m.external_id})`)
    if (m.email && !m.email.endsWith(`@${DOMINIO}`)) sospechosos.push(`miembro con correo real: ${nombre} <${m.email}>`)
  }
  for (const g of grupos) if (!g.name.includes(MARCA)) sospechosos.push(`grupo sin marca: ${g.name}`)
  if (sospechosos.length) {
    console.error('✋ ME NIEGO A BORRAR: hay objetos que no están marcados como prueba.\n')
    for (const s of sospechosos) console.error(`   · ${s}`)
    console.error('\n   Revisá a mano antes de seguir. No se tocó nada.\n')
    process.exit(1)
  }

  const memberIds = miembros.map(m => m.id)
  const groupIds = grupos.map(g => g.id)
  const eventIds = eventos.map(e => e.id)
  const formIds = forms.map(f => f.id)

  // ── 3. Inventario de lo dependiente ────────────────────────────────────────
  const contar = async (tabla: string, col: string, ids: string[]) => {
    if (!ids.length) return 0
    const { count } = await db.from(tabla).select('id', { count: 'exact', head: true }).in(col, ids)
    return count ?? 0
  }
  const inventario: Array<[string, number]> = [
    ['check-ins de evento', await contar('event_checkins', 'member_id', memberIds)],
    ['pagos', await contar('payments', 'member_id', memberIds)],
    ['becas', await contar('scholarships', 'member_id', memberIds)],
    ['donaciones', await contar('donations', 'member_id', memberIds)],
    ['matrículas', await contar('study_enrollments', 'member_id', memberIds)],
    ['recomendaciones CDEB', await contar('cdeb_recommendations', 'member_id', memberIds)],
    ['recomendaciones de cierre', await contar('member_recommendations', 'member_id', memberIds)],
    ['solicitudes de prematrimonial', await contar('prematrimonial_requests', 'requester_member_id', memberIds)],
    ['respuestas de formulario', await contar('form_responses', 'member_id', memberIds)],
    ['asignaciones de servicio', await contar('volunteers', 'member_id', memberIds)],
    ['roles', await contar('member_roles', 'member_id', memberIds)],
    ['notificaciones internas', await contar('internal_notifications', 'recipient_member_id', memberIds)],
  ]

  console.log(`Miembros marcados: ${miembros.length}`)
  for (const [q, n] of inventario) if (n) console.log(`  · ${n} ${q}`)
  console.log(`Grupos: ${grupos.length}${grupos.length ? ` (${grupos.map(g => g.name).join(', ')})` : ''}`)
  console.log(`Eventos: ${eventos.length} · Formularios: ${forms.length} · Listas: ${listas.length} · Puestos: ${puestos.length}`)
  console.log(`Usuarios de Auth a borrar: ${miembros.filter(m => m.auth_user_id).length}`)

  if (!APLICAR) {
    console.log('\nDRY-RUN: no se borró nada. Volvé a correr con --aplicar para hacerlo.\n')
    return
  }

  // ── 4. Borrado, de las hojas al tronco ─────────────────────────────────────
  const borrar = async (tabla: string, col: string, ids: string[]) => {
    if (!ids.length) return
    const { error: e } = await db.from(tabla).delete().in(col, ids)
    if (e) throw new Error(`${tabla}: ${e.message}`)
    console.log(`  ✓ ${tabla}`)
  }

  console.log('\nBorrando…')
  // Hojas que cuelgan del miembro.
  await borrar('event_checkins', 'member_id', memberIds)
  await borrar('form_responses', 'member_id', memberIds)
  await borrar('cdeb_recommendations', 'member_id', memberIds)
  await borrar('member_recommendations', 'member_id', memberIds)
  await borrar('prematrimonial_requests', 'requester_member_id', memberIds)
  await borrar('prematrimonial_requests', 'spouse_member_id', memberIds)
  // Los pagos referencian matrículas: van antes.
  await borrar('payments', 'member_id', memberIds)
  await borrar('scholarships', 'member_id', memberIds)
  await borrar('study_enrollments', 'member_id', memberIds)
  await borrar('donations', 'member_id', memberIds)
  await borrar('volunteers', 'member_id', memberIds)
  await borrar('internal_notifications', 'recipient_member_id', memberIds)
  await borrar('member_roles', 'member_id', memberIds)

  // Lo que cuelga de los objetos marcados (por si quedó gente real dentro).
  await borrar('study_enrollments', 'group_id', groupIds)
  await borrar('event_checkins', 'event_id', eventIds)
  await borrar('form_responses', 'form_id', formIds)

  // Los objetos.
  await borrar('study_groups', 'id', groupIds)
  await borrar('forms', 'id', formIds)
  await borrar('events', 'id', eventIds)
  await borrar('member_lists', 'id', listas.map(l => l.id))
  await borrar('service_positions', 'id', puestos.map(p => p.id))

  // Los miembros y sus cuentas de Auth.
  for (const m of miembros) {
    if (!m.auth_user_id) continue
    const { error: e } = await db.auth.admin.deleteUser(m.auth_user_id)
    if (e) console.warn(`  ⚠ auth ${m.email}: ${e.message}`)
  }
  await borrar('members', 'id', memberIds)

  console.log('\n✓ Set de prueba borrado.\n')
}

main().catch(e => { console.error('\n✗', e instanceof Error ? e.message : e); process.exit(1) })
