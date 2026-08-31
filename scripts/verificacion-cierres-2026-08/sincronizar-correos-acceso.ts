/**
 * Empareja el correo de la CUENTA con el de la FICHA para quien quedó con los
 * dos distintos (autorizado por el usuario, 2026-08-31).
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/sincronizar-correos-acceso.ts
 *   aplicar:  ... --aplicar
 *
 * Cómo se llegó acá: alguien corrigió el correo en el perfil y ninguna pantalla
 * tocaba la cuenta de Auth. El enlace de contraseña se busca por el correo de
 * la FICHA; si ese correo no existe como cuenta, no se manda nada y la pantalla
 * igual responde "ya le mandamos el enlace". Doce personas quedaron así y
 * ninguna había logrado entrar nunca.
 *
 * La dirección del arreglo es siempre la misma: manda la FICHA. Es la que
 * alguien corrigió a propósito, y es a la que se le manda el enlace.
 *
 * DOS CASOS, y solo uno se aplica solo:
 *   · el correo de la ficha NO tiene cuenta → se le cambia el correo a la
 *     cuenta que ya tiene. Automático.
 *   · el correo de la ficha YA tiene otra cuenta (la persona se registró por su
 *     lado, como pasó con Adriana) → NO se toca: hay dos cuentas y decidir cuál
 *     sobrevive es perder la que se descarte. Se reporta.
 */
import { cargarEnv, todo } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

type Caso = {
  member_id: string; nombre: string; ficha: string; cuenta: string
  auth_user_id: string; otraCuenta: string | null
}

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const { normalizarCorreo, errorDeCorreoDeAcceso } = await import('../../src/lib/auth/access-email')
  const c = createAdminClient() as unknown as {
    from: (t: string) => {
      select: (s: string) => { not: (a: string, b: string, d: unknown) => Promise<{ data: unknown[] | null }> }
      update: (v: Record<string, unknown>) => { eq: (a: string, b: string) => Promise<{ error: { message: string } | null }> }
    }
    auth: { admin: {
      listUsers: (o: { page: number; perPage: number }) => Promise<{ data: { users: Array<{ id: string; email?: string }> } | null }>
      updateUserById: (id: string, a: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    } }
  }

  // Todos los usuarios de Auth, para cruzar por correo sin ir uno por uno.
  const usuarios: Array<{ id: string; email?: string }> = []
  for (let page = 1; ; page++) {
    const { data } = await c.auth.admin.listUsers({ page, perPage: 1000 })
    const lote = data?.users ?? []
    usuarios.push(...lote)
    if (lote.length < 1000) break
  }
  const porId = new Map(usuarios.map(u => [u.id, normalizarCorreo(u.email)]))
  const porCorreo = new Map<string, string[]>()
  for (const u of usuarios) {
    const e = normalizarCorreo(u.email); if (!e) continue
    const a = porCorreo.get(e) ?? []; a.push(u.id); porCorreo.set(e, a)
  }
  console.log(`cuentas de Auth: ${usuarios.length}\n`)

  // Paginado: PostgREST corta en 1000 filas SIN avisar. Sin esto el script
  // miraba las primeras mil fichas de 23.700 y reportaba cero desincronizados
  // — un "no hay nada que arreglar" perfectamente convincente y falso.
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]
  const fichas = await todo<{ id: string; first_name: string; last_name: string; email: string | null; auth_user_id: string | null }>(
    admin, 'members', 'id, first_name, last_name, email, auth_user_id')
  console.log(`fichas: ${fichas.length}`)
  const casos: Caso[] = []
  for (const f of fichas) {
    if (!f.auth_user_id) continue
    const ficha = normalizarCorreo(f.email)
    const cuenta = porId.get(f.auth_user_id) ?? ''
    if (!ficha || !cuenta || ficha === cuenta) continue
    const otras = (porCorreo.get(ficha) ?? []).filter(id => id !== f.auth_user_id)
    casos.push({
      member_id: f.id, nombre: `${f.first_name} ${f.last_name}`, ficha, cuenta,
      auth_user_id: f.auth_user_id, otraCuenta: otras[0] ?? null,
    })
  }

  const automaticos = casos.filter(x => !x.otraCuenta && !errorDeCorreoDeAcceso(x.ficha))
  const conOtraCuenta = casos.filter(x => x.otraCuenta)
  const correoMalo = casos.filter(x => !x.otraCuenta && errorDeCorreoDeAcceso(x.ficha))

  console.log(`desincronizados: ${casos.length}`)
  console.log(`  se arreglan solos: ${automaticos.length}`)
  console.log(`  con otra cuenta ya usando ese correo: ${conOtraCuenta.length}`)
  console.log(`  con el correo de la ficha mal escrito: ${correoMalo.length}\n`)

  for (const x of automaticos) console.log(`  ✓ ${x.nombre.padEnd(30)} ${x.cuenta}  →  ${x.ficha}`)
  for (const x of conOtraCuenta) console.log(`  ⚠ ${x.nombre.padEnd(30)} ${x.ficha} YA es de otra cuenta — a mano`)
  for (const x of correoMalo) console.log(`  ⚠ ${x.nombre.padEnd(30)} correo de la ficha inválido: "${x.ficha}"`)

  if (!APLICAR) { console.log(`\n(dry-run) cambiaría ${automaticos.length}. Correlo con --aplicar.`); return }

  const { writeFileSync } = await import('node:fs')
  writeFileSync('scripts/output/correos-acceso-2026-08-31-antes.json', JSON.stringify(casos, null, 2))
  console.log('\nrespaldo → scripts/output/correos-acceso-2026-08-31-antes.json\n── aplicando ──')
  let ok = 0
  for (const x of automaticos) {
    // email_confirm: la dirección la puso el staff. Pedirle a la persona que
    // confirme un correo para poder entrar es justo lo que no le funciona.
    const { error } = await c.auth.admin.updateUserById(x.auth_user_id, { email: x.ficha, email_confirm: true })
    if (error) { console.log(`  ✗ ${x.nombre}: ${error.message}`); continue }
    console.log(`  ✓ ${x.nombre}`)
    ok++
  }
  console.log(`\n  cuentas emparejadas: ${ok}/${automaticos.length}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
