/**
 * Enlaza las cuentas que quedaron sin ficha por el caso FÁCIL: una sola ficha
 * con ese correo y sin conflicto. Usa la MISMA regla que aplica el sistema al
 * mandar el enlace de contraseña (planDeEnlace), así que no decide nada nuevo
 * — solo corre lo que ya debió correr.
 *
 * Los casos con el correo repartido entre varias fichas NO se tocan: ahí hay
 * que resolver el duplicado a mano.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { planDeEnlace, type FichaConCorreo } from '../../src/lib/auth/enlace-de-cuenta'
import { cuentasSinFicha, type FichaConCorreo as FichaDetector } from '../../src/lib/auth/cuentas-sin-ficha'

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const sb = createAdminClient()
  const cuentas: Array<{ id: string; email: string }> = []
  for (let page = 1; ; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users ?? []
    for (const u of users) if (u.email) cuentas.push({ id: u.id, email: u.email })
    if (users.length < 1000) break
  }
  const fichas: FichaDetector[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('members')
      .select('id, first_name, last_name, email, auth_user_id').not('email', 'is', null).range(from, from + 999)
    const filas = (data ?? []) as Array<{ id: string; first_name: string|null; last_name: string|null; email: string; auth_user_id: string|null }>
    for (const m of filas) fichas.push({ id: m.id, nombre: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(), email: m.email, auth_user_id: m.auth_user_id })
    if (filas.length < 1000) break
  }

  const casos = cuentasSinFicha(cuentas, fichas)
  let hechos = 0, saltados = 0
  for (const caso of casos) {
    const candidatas: FichaConCorreo[] = caso.fichas.map(f => {
      const full = fichas.find(x => x.id === f.id)!
      return { id: full.id, auth_user_id: full.auth_user_id }
    })
    const { data: dueno } = await sb.from('members').select('id').eq('auth_user_id', caso.auth_user_id).maybeSingle()
    const plan = planDeEnlace(candidatas, caso.auth_user_id, (dueno as { id: string } | null)?.id ?? null)
    if (plan.accion !== 'enlazar') {
      console.log(`  · ${caso.email}: se salta (${plan.motivo})`)
      saltados++
      continue
    }
    if (!aplicar) { console.log(`  [simulacro] ${caso.email} → ${caso.fichas[0].nombre}`); hechos++; continue }
    const { error } = await sb.from('members').update({ auth_user_id: caso.auth_user_id }).eq('id', plan.memberId)
    console.log(error ? `  ✗ ${caso.email}: ${error.message}` : `  ✓ ${caso.email} → ${caso.fichas[0].nombre}`)
    if (!error) hechos++
  }
  console.log(`\n${hechos} ${aplicar ? 'enlazadas' : 'se enlazarían'} · ${saltados} necesitan una persona`)
  if (!aplicar) console.log('\nSimulacro. Volvé a correrlo con --aplicar.')
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
