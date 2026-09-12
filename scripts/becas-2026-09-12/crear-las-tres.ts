/**
 * Crear las becas de las 3 solicitudes que finanzas aprobó sin que se creara
 * nada, y avisarles por correo.
 *   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local \
 *     scripts/becas-2026-09-12/crear-las-tres.ts [--aplicar]
 *
 * Las 6 del 2026-09-11 se cerraron desde el tablero genérico de finanzas, que
 * solo cambia el estado. Estas 3 son las que todavía NO se han matriculado, así
 * que alcanza con crearles la beca: el correo les avisa y al matricularse el
 * paso de pago ya les ofrece usarla.
 *
 * Las otras 3 (Gisselle, Valeria, Josué) ya pagaron algo y van aparte: ahí no
 * basta la beca, hay que resolver la plata.
 *
 * approveScholarshipRequest exige que la solicitud esté 'open' o 'in_review'
 * —y con razón: es lo que impide aprobar dos veces— así que se reabre a
 * 'in_review' y se aprueba, dejando las dos transiciones en el historial.
 *
 * OJO: el modo silencioso de correo está APAGADO. Con --aplicar salen correos
 * reales a personas reales.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { approveScholarshipRequest } from '@/lib/supabase/queries/scholarships'
import { updateFinanceRequestStatus } from '@/lib/supabase/queries/finance-requests'
import { isEmailSilentMode } from '@/lib/email/silent-mode'
import { textoDelDescuento } from '@/lib/finance/aprobacion-de-beca'

const APLICAR = process.argv.includes('--aplicar')

/** external_id → nombre esperado. Decisión del usuario 2026-09-12: beca del
 *  100% del costo del estudio. El match es por external_id; el nombre solo
 *  verifica, y si no calza el script aborta. */
const GENTE = [
  { ext: '4366',  nombre: 'Maria Jose Ruiz Fuentes' },
  { ext: '21055', nombre: 'Karla Avila Madriz' },
  { ext: '1500',  nombre: 'Monserrath Arroyo Rojas' },
]
const DESCUENTO = { discount_type: 'percentage' as const, discount_value: 100, approval_type: 'total' as const }

async function main() {
  const sb = createAdminClient()
  console.log(`modo silencioso de correo: ${isEmailSilentMode() ? 'ENCENDIDO (no sale nada)' : 'APAGADO — los correos SALEN'}\n`)

  // El actor que queda como aprobador. Se usa el mismo usuario de finanzas que
  // resolvió las solicitudes el 11, para que la traza no invente a otra persona.
  const { data: fin } = await sb.from('members')
    .select('id, auth_user_id, first_name, last_name').eq('id', 'fd7666c2-d552-4c3c-97cd-37effd8edf50').maybeSingle()
  const revisor = fin as { id: string; auth_user_id: string | null; first_name: string; last_name: string } | null
  if (!revisor?.auth_user_id) { console.error('ABORTA — no se pudo resolver el usuario de finanzas'); process.exit(1) }
  console.log(`aprobador: ${revisor.first_name} ${revisor.last_name}\n`)

  const plan: Array<{ reqId: string; nombre: string; email: string | null; destino: string; costo: string }> = []
  for (const g of GENTE) {
    const { data: m } = await sb.from('members')
      .select('id, first_name, last_name, email').eq('external_id', g.ext).maybeSingle()
    const miembro = m as { id: string; first_name: string; last_name: string; email: string | null } | null
    if (!miembro) { console.error(`ABORTA — no hay ficha con external_id ${g.ext}`); process.exit(1) }
    const completo = `${miembro.first_name} ${miembro.last_name}`.trim()
    if (completo !== g.nombre) { console.error(`ABORTA — ${g.ext} es «${completo}», se esperaba «${g.nombre}»`); process.exit(1) }

    const { data: r } = await sb.from('finance_requests')
      .select('id, status, plan_id, entity_type')
      .eq('member_id', miembro.id).eq('request_type', 'scholarship').maybeSingle()
    const req = r as { id: string; status: string; plan_id: string | null; entity_type: string | null } | null
    if (!req) { console.error(`ABORTA — ${completo} no tiene solicitud de beca`); process.exit(1) }

    const { data: p } = await sb.from('study_plans').select('name, cost, currency').eq('id', req.plan_id ?? '').maybeSingle()
    const pl = p as { name: string; cost: number | null; currency: string | null } | null

    // Guardia: si ya tiene beca de esa solicitud, no se duplica.
    const { data: ya } = await sb.from('scholarships').select('id').eq('request_id', req.id).maybeSingle()
    if (ya) { console.log(`   ${completo}: YA tiene beca de esta solicitud — se salta`); continue }

    plan.push({
      reqId: req.id, nombre: completo, email: miembro.email,
      destino: pl?.name ?? '(destino desconocido)',
      costo: `${pl?.currency ?? 'CRC'} ${pl?.cost ?? '?'}`,
    })
  }

  console.log('SE CREARÍAN ESTAS BECAS:')
  for (const x of plan) {
    console.log(`   ${x.nombre.padEnd(28)} ${x.destino.padEnd(26)} costo ${x.costo}`)
    console.log(`      descuento ${textoDelDescuento(DESCUENTO)} (${DESCUENTO.approval_type}) → correo a ${x.email ?? 'SIN CORREO'}`)
  }
  if (!APLICAR) { console.log('\n🔎 DRY RUN — no se creó ninguna beca ni salió ningún correo.'); return }

  for (const x of plan) {
    // Reabrir para que el flujo real la acepte, y aprobar por el mismo camino
    // que usa la pantalla: crea la beca, notifica y manda el correo.
    await updateFinanceRequestStatus(x.reqId, 'in_review', revisor.id, 'Reapertura para crear la beca que la aprobación del 11-set no llegó a crear.')
    await approveScholarshipRequest(x.reqId, {
      ...DESCUENTO, reviewerMemberId: revisor.id, reviewerUserId: revisor.auth_user_id!,
    })
    const { data: b } = await sb.from('scholarships')
      .select('id, discount_type, discount_value, email_sent_at, email_sent_to').eq('request_id', x.reqId).maybeSingle()
    const beca = b as { discount_type: string; discount_value: number; email_sent_at: string | null; email_sent_to: string | null } | null
    console.log(`   ${x.nombre.padEnd(28)} beca ${beca?.discount_value}${beca?.discount_type === 'percentage' ? '%' : ''}   correo: ${beca?.email_sent_at ? `enviado a ${beca.email_sent_to}` : 'NO SALIÓ'}`)
  }
  console.log('\n✅ APLICADO')
}
main().catch(e => { console.error(e); process.exit(1) })
