/**
 * Manda los acuses de las aplicaciones que quedaron sin ellos.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/aplicaciones-2026-10/reenviar-acuses.ts
 *   aplicar:  ... --aplicar
 *
 * POR QUÉ HACE FALTA (Floriana, 2026-10-08): los dos acuses —el de quien
 * aplicó y el del comité— se agregaron hoy. Las aplicaciones que entraron
 * ANTES no dispararon ninguno, y además la ficha que acompaña al del comité
 * traía el estudio equivocado: decía el último TERMINADO y no el que la
 * persona está llevando.
 *
 * USA LAS MISMAS FUNCIONES QUE EL ENDPOINT, no una copia: la ficha se arma
 * con `getDetalleDeAplicante`, que ya trae el estudio corregido. Con un
 * correo escrito acá, lo que se reenvía no sería lo que el sistema manda.
 *
 * SOLO LAS QUE SIGUEN ABIERTAS (`pending`). A una aplicación ya aprobada o
 * rechazada no se le manda «la recibimos, te contactamos en dos semanas»:
 * esa conversación ya pasó, y el acuse llegaría como una burla.
 */
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const APLICAR = process.argv.includes('--aplicar')

async function main() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { getDetalleDeAplicante } = await import('@/lib/supabase/queries/servers')
  const { notificarAlEncargado, notificarAcuseAlAplicante } =
    await import('@/lib/email/application-notify')
  const sb = createAdminClient()

  const { data } = await sb.from('applications')
    .select('id, status, created_at').eq('status', 'pending').order('created_at')
  const abiertas = (data ?? []) as Array<{ id: string; status: string; created_at: string }>

  console.log(`aplicaciones abiertas: ${abiertas.length}\n`)
  let aplicante = 0, comite = 0
  for (const a of abiertas) {
    const d = await getDetalleDeAplicante(a.id)
    if (!d) { console.log(`  ✗ ${a.id}: no se pudo armar la ficha`); continue }

    console.log(`· ${d.nombre} — ${d.puesto} (${d.comite})`)
    console.log(`    correo: ${d.correo ?? 'SIN CORREO'}`)
    console.log(`    último estudio: ${d.ultimoEstudio ?? '—'} · dirigente: ${d.dirigente ?? '—'}`)

    if (!APLICAR) continue

    const r1 = await notificarAcuseAlAplicante({
      correo: d.correo, nombre: d.nombre, puesto: d.puesto, comite: d.comite,
    })
    if (r1.enviado) aplicante++
    const r2 = await notificarAlEncargado({
      committeeId: d.committee_id, detalle: d, momento: 'recibida',
    })
    comite += r2.enviados
    console.log(`    → aplicante: ${r1.enviado ? '✓' : '✗'}  ·  comité: ${r2.enviados} correo(s)`)
  }

  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); return }
  console.log(`\nenviados — a aplicantes: ${aplicante}  ·  a comités: ${comite}`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
