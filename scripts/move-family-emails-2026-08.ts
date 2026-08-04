/**
 * One-off: mueve el correo (y su cuenta de acceso) de la ficha de un familiar a la
 * del servidor a quien realmente pertenece.
 *
 * Uso:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/move-family-emails-2026-08.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/move-family-emails-2026-08.ts --commit
 *
 * EL PROBLEMA: 15 servidores de la lista del campa no tienen correo en su ficha, y
 * el correo que CCB trae para ellos está registrado en la ficha de un pariente. En
 * casi todos los casos el correo lleva el nombre del SERVIDOR (jimmyperaza@… en la
 * ficha de Naomi Peraza), o sea que el import viejo lo puso en la ficha equivocada.
 *
 * POR QUÉ SE MUEVE TAMBIÉN LA CUENTA: la cuenta de Supabase Auth tiene ese correo.
 * Si se mueve el correo y la cuenta se queda colgada de la ficha del pariente, el
 * link de contraseña del servidor cae en esa cuenta y ENTRA VIENDO EL PERFIL DEL
 * PARIENTE. Se mueven juntos o no se mueve nada.
 *
 * GUARDA DURA: si la cuenta del pariente FUE ACTIVADA, el caso se salta. Ahí ya hay
 * alguien usándola y moverla le quitaría el acceso.
 *
 * Los tres casos donde el correo parece ser de verdad del pariente (Geovanny Rizo →
 * hdiazm@ice.co.cr de Hilda Díaz; José Pablo Rojas → projas@pczonecr.com
 * corporativo; y Cristina Pacheco, pendiente de confirmar) NO están en esta lista.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

for (const file of ['.env', '.env.local']) {
  try {
    const t = readFileSync(join(process.cwd(), file), 'utf8')
    for (const line of t.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sigue */ }
}

/** Los 12 confirmados: [external_id del servidor, correo, external_id del dueño actual]. */
const CASOS: Array<[string, string, string]> = [
  ['10896', 'carolina.salas21@outlook.com', '10971'], // Carolina Salas Mena ← Santiago Badilla Salas
  ['798',   'ekaroj@gmail.com',             '10552'], // Ekaterina Rojas    ← Ignacio Pereira Rojas
  ['6768',  'figura1970@yahoo.com',         '7967'],  // Fernando Chavarria ← Daniela Chavarria
  ['20698', 'vivas_96m@outlook.com',        '21875'], // George Vivas       ← Reyna Vivas
  ['8161',  'jimmyperaza@gmail.com',        '8535'],  // Jimmy Peraza       ← Naomi Peraza Chacon
  ['2557',  'josequiroscr@gmail.com',       '3729'],  // Jose Quiros        ← Maripaz Fernandez
  ['16539', 'kwebbc2@gmail.com',            '16538'], // Kimberly Webb      ← Jorge Montero Sibaja
  ['1210',  'laupaniagua_@hotmail.com',     '18835'], // Laura Paniagua     ← Maria Eugenia Lopez
  ['17030', 'marijomor.les@gmail.com',      '22561'], // Maria Moraga       ← Gisselle González
  ['19316', 'marshaepc@gmail.com',          '23943'], // Marsha Ramos       ← Silvia Alfaro
  ['1451',  'maxalvaradomora@yahoo.com',    '6202'],  // Max Alvarado       ← Diego Alvarado mora
  ['21844', 'paoqb2@gmail.com',             '22304'], // Paola Quirós       ← Grace Barrantes
]

type Member = {
  id: string; first_name: string | null; last_name: string | null; external_id: string | null
  email: string | null; auth_user_id: string | null; account_confirmed_at: string | null
}
const F = 'id,first_name,last_name,external_id,email,auth_user_id,account_confirmed_at'
const nombre = (m: Member) => `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()

async function main() {
  const commit = process.argv.includes('--commit')
  const { createAdminClient } = await import('../src/lib/supabase/admin')
  const db = createAdminClient()

  const ext = [...new Set(CASOS.flatMap(([a, , c]) => [a, c]))]
  const { data, error } = await db.from('members').select(F).in('external_id', ext)
  if (error) throw error
  const byExt = new Map((data as Member[]).map(m => [(m.external_id ?? '').trim(), m]))

  type Listo = { servidor: Member; dueno: Member; email: string; authId: string }
  const listos: Listo[] = []
  const saltados: Array<{ caso: [string, string, string]; motivo: string }> = []

  for (const caso of CASOS) {
    const [extServ, email, extDueno] = caso
    const servidor = byExt.get(extServ)
    const dueno = byExt.get(extDueno)
    if (!servidor) { saltados.push({ caso, motivo: `no existe el miembro CCB ${extServ}` }); continue }
    if (!dueno) { saltados.push({ caso, motivo: `no existe el miembro CCB ${extDueno}` }); continue }
    if ((dueno.email ?? '').trim().toLowerCase() !== email) {
      saltados.push({ caso, motivo: `CCB ${extDueno} ya no tiene ese correo (tiene "${dueno.email ?? 'ninguno'}")` }); continue
    }
    if ((servidor.email ?? '').trim()) {
      saltados.push({ caso, motivo: `${nombre(servidor)} ya tiene correo: ${servidor.email}` }); continue
    }
    // GUARDA: cuenta en uso → no se toca.
    if (dueno.account_confirmed_at) {
      saltados.push({ caso, motivo: `la cuenta de ${nombre(dueno)} FUE ACTIVADA el ${dueno.account_confirmed_at.slice(0, 10)}` }); continue
    }
    if (servidor.auth_user_id) {
      saltados.push({ caso, motivo: `${nombre(servidor)} ya tiene cuenta propia (${servidor.auth_user_id})` }); continue
    }
    listos.push({ servidor, dueno, email, authId: dueno.auth_user_id ?? '' })
  }

  const L = (s = '') => console.log(s)
  L(`Casos definidos: ${CASOS.length}`)
  L(`  Listos para mover : ${listos.length}`)
  L(`  Saltados          : ${saltados.length}`)
  L()
  for (const { servidor, dueno, email, authId } of listos) {
    L(`── ${email}`)
    L(`   DE   ${nombre(dueno)} (CCB ${dueno.external_id})`)
    L(`        email → null   |   auth_user_id → null${authId ? '' : '   (no tenía cuenta)'}`)
    L(`   A    ${nombre(servidor)} (CCB ${servidor.external_id})`)
    L(`        email → ${email}   |   auth_user_id → ${authId || '(queda sin cuenta)'}`)
    L()
  }
  if (saltados.length) {
    L('── SALTADOS ────────────────────────────────────────')
    for (const s of saltados) L(`   · CCB ${s.caso[0]} (${s.caso[1]}): ${s.motivo}`)
    L()
  }

  if (!commit) {
    L('DRY-RUN: no se escribió NADA. Volvé a correrlo con --commit.')
    return
  }

  let ok = 0
  for (const { servidor, dueno, email, authId } of listos) {
    // Primero liberar al dueño: así el correo no queda en dos fichas en ningún
    // instante, ni siquiera entre las dos escrituras.
    const { error: e1 } = await db.from('members')
      .update({ email: null, auth_user_id: null }).eq('id', dueno.id)
    if (e1) { console.error(`✗ ${nombre(dueno)}: ${e1.message}`); continue }
    const { error: e2 } = await db.from('members')
      .update({ email, auth_user_id: authId || null }).eq('id', servidor.id)
    if (e2) {
      console.error(`✗ ${nombre(servidor)}: ${e2.message} — revirtiendo`)
      await db.from('members').update({ email, auth_user_id: authId || null }).eq('id', dueno.id)
      continue
    }
    ok++
    console.log(`✓ ${email}: ${nombre(dueno)} → ${nombre(servidor)}`)
  }
  L()
  L(`Movidos ${ok} de ${listos.length}.`)
}

main().catch(e => { console.error(e); process.exit(1) })
