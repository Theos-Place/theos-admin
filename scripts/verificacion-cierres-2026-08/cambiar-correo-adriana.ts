/**
 * Cambia el correo de Adriana Jiménez Sanabria (pedido del usuario 2026-08-31):
 * adrichic20@hotmail.com → adrijimenezs@gmail.com
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/cambiar-correo-adriana.ts
 *   aplicar:  ... --aplicar
 *
 * Se cambia en LOS DOS lados: la ficha (members.email) y la cuenta de acceso
 * (auth.users.email). Ninguna pantalla de la app hace lo segundo hoy, así que
 * cambiar solo la ficha le dejaba el login pegado al correo viejo — y el enlace
 * de contraseña, que se manda al correo de la FICHA, llegando a una dirección
 * que ya no abre la cuenta.
 *
 * Contexto: es la persona que no recibía el correo para registrarse. Que el
 * nuevo sea un gmail ayuda —los enlaces a su hotmail no le llegaban— pero eso
 * se verifica aparte, no lo resuelve este cambio.
 */
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

const MEMBER_ID = 'a729c17a-d79c-4936-8a93-599e3926af27'
const VIEJO = 'adrichic20@hotmail.com'
const NUEVO = 'adrijimenezs@gmail.com'

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const c = createAdminClient() as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (a: string, b: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
        ilike: (a: string, b: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
      }
      update: (v: Record<string, unknown>) => { eq: (a: string, b: string) => Promise<{ error: { message: string } | null }> }
    }
    auth: { admin: {
      updateUserById: (id: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
      listUsers: (o: { page: number; perPage: number }) => Promise<{ data: { users: Array<{ id: string; email?: string }> } | null; error: unknown }>
    } }
  }

  const { data: fichas } = await c.from('members').select('id, first_name, last_name, email, auth_user_id').eq('id', MEMBER_ID)
  const m = ((fichas ?? [])[0] ?? null) as { first_name: string; last_name: string; email: string | null; auth_user_id: string | null } | null
  if (!m) { console.log('✗ no existe la ficha'); process.exit(1) }
  console.log(`ficha: ${m.first_name} ${m.last_name}`)
  console.log(`  correo actual: ${m.email}`)
  console.log(`  cuenta de acceso: ${m.auth_user_id ?? '(ninguna)'}`)
  // La ficha YA la cambió el staff desde la pantalla (31/08 15:36). Lo que
  // quedó atrás es la cuenta de acceso: ninguna pantalla de la app la toca, así
  // que Adriana tendría que seguir entrando con el hotmail y los enlaces le
  // seguirían llegando ahí. Se acepta cualquiera de los dos estados de la ficha
  // y se empareja la cuenta, que es lo que falta.
  const yaEnFicha = (m.email ?? '').toLowerCase() === NUEVO
  if (!yaEnFicha && (m.email ?? '').toLowerCase() !== VIEJO) {
    console.log(`✗ el correo de la ficha no es ni ${VIEJO} ni ${NUEVO} — no toco nada`); process.exit(1)
  }
  if (yaEnFicha) console.log('  · la ficha ya tiene el correo nuevo; falta la cuenta de acceso')

  // GUARDA: que el correo nuevo no sea de otra persona. La base NO tiene UNIQUE
  // en members.email (el dedupe es a nivel de app), así que acá se mira a mano.
  const { data: choque } = await c.from('members').select('id, first_name, last_name').ilike('email', NUEVO)
  const otros = ((choque ?? []) as Array<{ id: string; first_name: string; last_name: string }>).filter(x => x.id !== MEMBER_ID)
  if (otros.length) {
    console.log(`✗ ${NUEVO} ya lo tiene: ${otros.map(o => `${o.first_name} ${o.last_name}`).join(', ')}`)
    process.exit(1)
  }
  console.log(`  ✓ ${NUEVO} está libre en members`)

  if (!APLICAR) {
    console.log('\n(dry-run) haría:')
    console.log(`  1. members.email → ${NUEVO}`)
    if (m.auth_user_id) console.log(`  2. auth.users.email de ${m.auth_user_id} → ${NUEVO}`)
    return
  }

  if (!yaEnFicha) {
    const r = await c.from('members').update({ email: NUEVO }).eq('id', MEMBER_ID)
    if (r.error) throw new Error(`ficha: ${r.error.message}`)
    console.log(`  ✓ ficha actualizada`)
  }

  if (m.auth_user_id) {
    // email_confirm: la dirección la da el staff, no hay que pedirle a Adriana
    // que confirme un correo para poder entrar — justo lo que no le funciona.
    const { error } = await c.auth.admin.updateUserById(m.auth_user_id, { email: NUEVO, email_confirm: true })
    if (error) throw new Error(`cuenta de acceso: ${error.message}`)
    console.log(`  ✓ cuenta de acceso actualizada`)
  }

  const { data: fin } = await c.from('members').select('email, auth_user_id').eq('id', MEMBER_ID)
  console.log('\nqueda:', JSON.stringify((fin ?? [])[0]))
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
