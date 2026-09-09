/**
 * Cambiar el correo de acceso de Otto y Cristina a las direcciones de la hoja
 * del 8-sep, y borrar los dos eventos de prueba que quedaban.
 *
 * EL CORREO NO SE CAMBIA CON UN UPDATE. Los dos tienen cuenta, y members.email
 * y auth.users.email son campos distintos: tocar solo el primero les deja el
 * perfil con una dirección y el login con otra. Se sigue el MISMO camino que la
 * pantalla /api/members/[id]/access-email, que ya resolvió esto:
 *
 *   · buscar_cuenta_por_correo en vez de listUsers — listUsers mira 1000 de las
 *     18 mil cuentas y el guard fallaba para el 95% del padrón;
 *   · planDeCambioDeCorreo decide si se renombra, se religa o se bloquea cuando
 *     la dirección nueva ya es de otra cuenta;
 *   · email_confirm al mover, para no pedirle a la persona que confirme un
 *     correo justo cuando no puede entrar;
 *   · se limpian email_bounced / email_complained, que eran marcas de la
 *     dirección VIEJA — sin esto, corregir un correo deja a la persona igual de
 *     excluida de las campañas.
 *
 * OJO: la hoja marca ottoalfredo@oac.cr como POR VERIFICAR. Se aplica porque el
 * usuario lo pidió sabiéndolo; el correo anterior queda impreso en este reporte
 * para poder volver atrás.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-charla-2026-09-08/correos-y-limpieza.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-charla-2026-09-08/correos-y-limpieza.ts --aplicar
 */
import { readFileSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const CORREOS = [
  { telefono: '88850898', esperado: 'Otto Alfredo Cheves Campos', nuevo: 'ottoalfredo@oac.cr' },
  { telefono: '88193335', esperado: 'Cristina Rojas Zapata', nuevo: 'crisroza07@gmail.com' },
]

const EVENTOS = [
  { titulo: 'Prueba' },
  // El guion del tutorial la recrea sola si no existe (scripts/tutoriales/checkin.ts),
  // así que borrarla no rompe la grabación.
  { titulo: '[prueba] Charla de bienvenida' },
]

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const { planDeCambioDeCorreo } = await import('../../src/lib/auth/access-email-plan')
  const { normalizarCorreo } = await import('../../src/lib/auth/access-email')
  const sb = createAdminClient()

  console.log('CORREO DE ACCESO\n')
  for (const c of CORREOS) {
    const { data } = await sb.from('members')
      .select('id, first_name, last_name, email, auth_user_id').eq('phone', c.telefono)
    const filas = (data ?? []) as Array<{ id: string; first_name: string; last_name: string; email: string | null; auth_user_id: string | null }>
    if (filas.length !== 1) { console.log(`  ⚠️  ${c.esperado}: ${filas.length} fichas con ese teléfono — se omite`); continue }
    const m = filas[0]
    const nombre = `${m.first_name} ${m.last_name}`.trim()
    if (nombre !== c.esperado) { console.log(`  ⚠️  se esperaba «${c.esperado}» y dice «${nombre}» — se omite`); continue }

    const email = normalizarCorreo(c.nuevo)
    console.log(`  ${nombre}`)
    console.log(`    de: ${m.email ?? '(sin correo)'}`)
    console.log(`    a:  ${email}`)

    if (!m.auth_user_id) {
      console.log('    sin cuenta de acceso: solo cambia la ficha')
      if (aplicar) await sb.from('members').update({ email }).eq('id', m.id)
      continue
    }

    const { data: enc } = await sb.rpc('buscar_cuenta_por_correo' as never, { p_email: email } as never)
    const otra = ((enc ?? []) as Array<{ id: string; ha_entrado: boolean; fichas: number }>)[0] ?? null
    const { data: mia } = await sb.rpc('buscar_cuenta_por_correo' as never, { p_email: m.email ?? '' } as never)
    const actualInfo = ((mia ?? []) as Array<{ id: string; ha_entrado: boolean; fichas: number }>)
      .find(u => u.id === m.auth_user_id)

    const plan = planDeCambioDeCorreo({
      actual: { id: m.auth_user_id, haEntrado: !!actualInfo?.ha_entrado, fichas: Number(actualInfo?.fichas ?? 1) },
      conEseCorreo: otra ? { id: otra.id, haEntrado: !!otra.ha_entrado, fichas: Number(otra.fichas) } : null,
    })
    console.log(`    plan: ${plan.accion}${plan.accion === 'bloquear' ? ` — ${plan.motivo}` : ''}`)
    if (plan.accion === 'bloquear') continue

    if (!aplicar) { console.log('    [simulacro] no se escribe'); continue }

    if (plan.accion === 'religar') {
      await sb.from('members').update({ auth_user_id: plan.cuentaNueva, email }).eq('id', m.id)
      const { error } = await sb.auth.admin.deleteUser(plan.cuentaAbandonada)
      if (error) console.warn(`    (quedó una cuenta sin dueño: ${error.message})`)
      console.log('    ✓ religada a la cuenta que ya usaba')
      continue
    }

    const { error: authErr } = await sb.auth.admin.updateUserById(m.auth_user_id, { email, email_confirm: true })
    if (authErr) { console.log(`    ✗ Auth rechazó el cambio: ${authErr.message}`); continue }
    await sb.from('members').update({
      email, email_bounced: false, email_bounced_at: null,
      email_complained: false, email_complained_at: null,
    }).eq('id', m.id)
    console.log('    ✓ cambiado en la ficha Y en la cuenta de acceso')
  }

  console.log('\nBORRAR EVENTOS DE PRUEBA\n')
  for (const e of EVENTOS) {
    const { data } = await sb.from('events').select('id, title').eq('title', e.titulo)
    const evs = (data ?? []) as Array<{ id: string; title: string }>
    if (evs.length !== 1) { console.log(`  ⚠️  «${e.titulo}»: ${evs.length} coincidencias — se omite`); continue }
    const { count: ck } = await sb.from('event_checkins').select('id', { count: 'exact', head: true }).eq('event_id', evs[0].id)
    const { count: sub } = await sb.from('sub_events').select('id', { count: 'exact', head: true }).eq('event_id', evs[0].id)
    if (!aplicar) { console.log(`  [simulacro] «${e.titulo}» → ${ck} check-ins, ${sub} sub-eventos (cascada)`); continue }
    const { error } = await sb.from('events').delete().eq('id', evs[0].id)
    if (error) throw error
    console.log(`  ✓ «${e.titulo}» borrado (${ck} check-ins, ${sub} sub-eventos)`)
  }

  if (!aplicar) console.log('\nSIMULACRO. Nada se escribió. Volvé a correrlo con --aplicar.')
}

main().catch(e => { console.error(e); process.exit(1) })
