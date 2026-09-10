/**
 * Cuatro personas que llegaron a la Charla Pedregal Miércoles del 9/9/2026.
 *
 * Stephanie Porras NO es nueva: ya estaba en el padrón con el mismo teléfono,
 * la misma fecha de nacimiento y el mismo correo. Solo le faltaba el check-in.
 *
 * El correo de Karla venía cortado en la captura y lo confirmó el usuario
 * (2026-09-10). No se adivinó: un dominio inventado le manda la cuenta de esa
 * persona a un tercero.
 *
 * Matthew (2023) es hijo de María Cristina: mismo teléfono, mismo correo, y su
 * segundo apellido es el primero de ella. Se los vincula como familia.
 *
 * NO se le pone sub-evento a Matthew: el único que hay es "Youth", que no es
 * para un niño de 2 años.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/charla-pedregal-2026-09-09/alta-y-checkin.ts
 *   ... --aplicar
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { createMember } from '../../src/lib/supabase/queries/members-mutations'
import { createCheckin } from '../../src/lib/supabase/queries/events'

const EVENTO = 'd40fad32-5fec-4fb8-91e1-f58e644c711e' // Charla Pedregal Miércoles, 9/9/2026
const STEPHANIE = '1bf0a41c-d64f-422c-8325-2e7dd32f1e3f'

type Alta = {
  first_name: string; last_name: string
  email: string | null; phone: string; birth_date: string
}
const NUEVAS: Alta[] = [
  { first_name: 'Karla',          last_name: 'Rodríguez Guerrero', email: 'karla.rodriguezguerrero76@gmail.com', phone: '89939246', birth_date: '1976-04-20' },
  { first_name: 'María Cristina', last_name: 'Víquez León', email: 'cvl306@gmail.com', phone: '89959719', birth_date: '1992-06-30' },
  { first_name: 'Matthew',        last_name: 'Vargas Víquez', email: 'cvl306@gmail.com', phone: '89959719', birth_date: '2023-03-08' },
]

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const sb = createAdminClient()
  const creados: Record<string, string> = {}

  for (const p of NUEVAS) {
    const nombre = `${p.first_name} ${p.last_name}`
    // Idempotente: si ya se corrió, no crea una segunda ficha.
    const { data: ya } = await sb.from('members')
      .select('id').eq('phone', p.phone).eq('birth_date', p.birth_date).maybeSingle()
    if (ya) {
      creados[nombre] = (ya as { id: string }).id
      console.log(`ya existía: ${nombre} → ${creados[nombre]}`)
      continue
    }
    if (!aplicar) { console.log(`[simulacro] crear ${nombre} · ${p.email} · ${p.phone} · nace ${p.birth_date}`); continue }
    const m = await createMember({
      first_name: p.first_name, last_name: p.last_name,
      email: p.email, phone: p.phone, birth_date: p.birth_date, is_active: true,
    } as Parameters<typeof createMember>[0])
    creados[nombre] = m.id
    console.log(`✓ creada: ${nombre} → ${m.id}`)
  }

  // Familia: madre e hijo.
  const madre = creados['María Cristina Víquez León']
  const hijo = creados['Matthew Vargas Víquez']
  if (aplicar && madre && hijo) {
    const { data: yaFam } = await sb.from('family_members').select('family_unit_id').eq('member_id', madre).maybeSingle()
    if (yaFam) {
      console.log('la madre ya está en una familia, no se crea otra')
    } else {
      const { createFamily } = await import('../../src/lib/supabase/queries/members-mutations')
      const f = await createFamily({
        name: 'Víquez León',
        members: [{ member_id: madre, relation: 'Madre' }, { member_id: hijo, relation: 'Hijo/a' }],
      })
      console.log(`✓ familia creada: ${f.id}`)
    }
  }

  // Check-ins. Como asistentes, sin sub-evento.
  const aRegistrar: [string, string][] = [
    ['Stephanie Porras', STEPHANIE],
    ...Object.entries(creados).map(([n, id]) => [n, id] as [string, string]),
  ]
  for (const [nombre, memberId] of aRegistrar) {
    const { data: ya } = await sb.from('event_checkins')
      .select('id').eq('event_id', EVENTO).eq('member_id', memberId).maybeSingle()
    if (ya) { console.log(`  ya tenía check-in: ${nombre}`); continue }
    if (!aplicar) { console.log(`  [simulacro] check-in de ${nombre}`); continue }
    const c = await createCheckin(EVENTO, { member_id: memberId, method: 'manual', checked_in_as: 'asistente' })
    console.log(`  ✓ check-in: ${nombre} → ${c.id}`)
  }

  if (!aplicar) console.log('\nSimulacro. Volvé a correrlo con --aplicar.')
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
