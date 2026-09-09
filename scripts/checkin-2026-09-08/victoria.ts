/**
 * Alta de Victoria Badilla Saxe y su check-in en la Charla Meridiano Martes del
 * 8-sep-2026.
 *
 * Por qué a mano: el equipo de bienvenida intentó registrarla en la fila y la
 * pantalla respondió "No se pudo crear a Victoria". Era el 403 del bug de
 * permisos —encargado_eventos no podía crear miembros—, ya arreglado. Su ficha
 * nunca llegó a existir, así que la asistencia se recupera acá.
 *
 * Los datos salen de la captura del formulario que quedó a medio enviar.
 *
 * NO se le manda la invitación de cuenta: el correo saldría hoy por algo que
 * pasó ayer, y eso lo decide quien la atendió, no este script.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/checkin-2026-09-08/victoria.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/checkin-2026-09-08/victoria.ts --aplicar
 */
import { readFileSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const EVENTO = '3f012644-2c2e-482b-891b-2fdfc0afd9b9' // Charla Meridiano Martes, 08-sep-2026
// 19:23 hora CR del 8 de setiembre, que es cuando estaba en la fila (la captura
// del intento fallido marca las 7:23 p. m.). CR es UTC-6 fijo.
const CUANDO = '2026-09-09T01:23:00Z'

const DATOS = {
  first_name: 'Victoria',
  last_name: 'Badilla Saxe',
  phone: '87060444',
  email: 'vitos_78@hotmail.com',
  cedula: '110531037',
  document_type: 'cedula',
  birth_date: '1960-05-22',
}

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const { findMemberByCedulaOrEmail, createMember } = await import('../../src/lib/supabase/queries/members')
  const sb = createAdminClient()

  const { data: evento } = await sb.from('events').select('id, title, starts_at').eq('id', EVENTO).single()
  console.log(`Evento: ${evento!.title} — ${new Date(evento!.starts_at as string).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })}`)

  // Mismo dedup que usa el alta normal: si su documento o correo ya es de
  // alguien, no se crea una segunda ficha.
  const choque = await findMemberByCedulaOrEmail(DATOS.cedula, DATOS.email, undefined, 'cedula')
  if (choque) {
    console.log(`\nYa hay una ficha con esa cédula o correo (${choque.id}). No se crea nada; revisala a mano.`)
    return
  }

  if (!aplicar) {
    console.log('\n[simulacro] se crearía:', DATOS)
    console.log(`[simulacro] y su check-in en ${evento!.title} a las 19:23 del 08-sep (method manual)`)
    console.log('\nVolvé a correrlo con --aplicar para escribir.')
    return
  }

  const miembro = await createMember(DATOS as Parameters<typeof createMember>[0])
  console.log(`\nFicha creada: ${miembro.id}`)

  // Se calca el formato de las otras 175 filas del evento: method 'manual',
  // sin sub-evento y sin notes.
  const { error } = await sb.from('event_checkins').insert({
    event_id: EVENTO,
    member_id: miembro.id,
    method: 'manual',
    checked_in_at: CUANDO,
  })
  if (error) throw error

  const { count } = await sb.from('event_checkins')
    .select('id', { count: 'exact', head: true }).eq('event_id', EVENTO)
  console.log(`Check-in registrado. El evento queda con ${count} personas.`)
  console.log('\nOJO: NO se le envió la invitación de cuenta. Si querés que la reciba, decime.')
}

main().catch(e => { console.error(e); process.exit(1) })
