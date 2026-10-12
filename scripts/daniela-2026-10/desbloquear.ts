/**
 * Daniela Céspedes Cedeño no puede entrar: su cuenta está bloqueada.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/daniela-2026-10/desbloquear.ts
 *   aplicar:  ... --aplicar
 *
 * QUÉ PASÓ, en orden (medido el 2026-10-12):
 *
 *  · Ella tenía DOS fichas con el mismo correo: la suya (n. 1993) sin correo
 *    ni cuenta, y una duplicada registrada con fecha de nacimiento 2011 —una
 *    MENOR— que sí tenía el correo y la cuenta.
 *  · La cuenta se bloqueó por la regla de menores (AUTH-1): correcto para la
 *    ficha a la que pertenecía entonces.
 *  · Hoy a las 09:19 se fusionaron las dos fichas. La adulta heredó el correo
 *    y la cuenta… con el bloqueo puesto.
 *  · Desde entonces pide el enlace, le llega, y al abrirlo dice «el enlace no
 *    es válido». El sistema SÍ sabe avisar que una cuenta está deshabilitada,
 *    pero solo se lo dice a quien es menor según su ficha — y la de ella ya
 *    dice 1993. Así que quedó en el bucle sin explicación.
 *
 * Se desbloquea con la MISMA llamada del cron `desbloquear-mayores`
 * (`ban_duration: 'none'`), no con un UPDATE a `auth.users`: el estado de una
 * cuenta lo lleva Auth y tocarlo por SQL deja la caché de Auth diciendo otra
 * cosa.
 */
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const MEMBER = 'c55c249a-9c11-453e-ba03-d4d7166e5f79'
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const sb = createAdminClient()

  const { data: m } = await sb.from('members')
    .select('id, first_name, last_name, email, birth_date, auth_user_id, is_active')
    .eq('id', MEMBER).single()
  if (!m?.auth_user_id) throw new Error('La ficha no tiene cuenta.')

  const edad = m.birth_date
    ? Math.floor((Date.now() - new Date(m.birth_date).getTime()) / 31557600000) : null
  console.log(`${m.first_name} ${m.last_name} · ${m.email} · ${edad} años · ficha ${m.is_active ? 'activa' : 'INACTIVA'}`)

  // No se desbloquea a un menor ni por error: el bloqueo es la regla, no el bug.
  if (edad !== null && edad < 18) throw new Error(`Tiene ${edad} años: el bloqueo es correcto, no se toca.`)
  if (!m.is_active) throw new Error('La ficha está inactiva: no se reactiva una cuenta de una ficha muerta.')

  const { data: u } = await sb.auth.admin.getUserById(m.auth_user_id)
  const hasta = (u?.user as { banned_until?: string | null } | undefined)?.banned_until
  const bloqueada = !!hasta && new Date(hasta) > new Date()
  console.log(`cuenta ${u?.user?.email} · bloqueada: ${bloqueada ? `sí, hasta ${hasta}` : 'no'}`)
  console.log(`correo confirmado: ${u?.user?.email_confirmed_at ? 'sí' : 'NO'}`)

  if (!bloqueada) { console.log('\nNada que hacer: ya está desbloqueada.'); return }
  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); return }

  const { error } = await sb.auth.admin.updateUserById(m.auth_user_id, { ban_duration: 'none' })
  if (error) throw new Error(error.message)

  const { data: v } = await sb.auth.admin.getUserById(m.auth_user_id)
  const ahora = (v?.user as { banned_until?: string | null } | undefined)?.banned_until
  console.log(`\n✓ desbloqueada · banned_until = ${ahora ?? 'null'}`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
