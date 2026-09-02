/**
 * Aviso a quien tiene la matrícula sin comprobante: subilo o se libera el cupo.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/avisar-matricula-sin-comprobante.ts
 *   enviar:   ... --enviar
 *
 * A QUIÉNES. Solo a las matrículas en 'pendiente_de_pago' sin comprobante — o
 * sea, exactamente a las que el barrido SÍ va a soltar. Las automáticas del
 * cierre quedan 'enrolled' y NO reciben esto: a esas nadie les va a quitar el
 * cupo y mandarles la advertencia sería asustarlas con algo que no va a pasar.
 *
 * La lista se calcula al momento del envío contra la base, no se escribe a
 * mano: si alguien sube el comprobante entre que se revisa y se manda, deja de
 * estar en la lista sola.
 */
import { Client } from 'pg'
import { cargarEnv } from './lib'

cargarEnv()
const ENVIAR = process.argv.includes('--enviar')

/** El barrido corre a las 16:00 UTC, que en Costa Rica son las 10 a.m. */
const LIMITE = 'mañana a las 10 de la mañana'

function cuerpo(nombre: string, estudio: string, monto: string, detalle: string): string {
  return `<p class="greeting">Hola, ${nombre}</p>

<p>Empezaste a matricularte en <strong>${estudio}</strong>, pero todavía no nos llegó
tu comprobante de pago, así que la matrícula <strong>no está confirmada</strong>.</p>

<p><strong>Si no lo subís antes de ${LIMITE}, tu espacio se libera</strong> para que otra
persona lo pueda tomar. No es una sanción: es para que un cupo no quede apartado por alguien
que al final no va a llevar el estudio.</p>

<p>Y si eso pasa, no perdés nada: <strong>te podés volver a matricular cuando querás</strong>,
siempre que el grupo tenga campo.</p>

<div class="info-box">
  <p class="info-title">Qué tenés que hacer</p>
  <p style="font-size:14px; color:#555; line-height:1.9; margin:0;">
    <strong>1.</strong> Hacé el pago de <strong>${monto}</strong>.<br />
    <strong>2.</strong> Entrá a <a href="https://admin.theosplace.org/mis-pagos" style="color:#3B7579;">Pagos pendientes</a>.<br />
    <strong>3.</strong> Subí la captura del comprobante y el número de referencia.
  </p>
</div>

${detalle}

<p style="font-size:13px; color:#777; line-height:1.7;">
  ¿Ya pagaste y no lo has subido? Subilo igual — es lo único que nos falta para confirmarte.
  ¿Ya no querés llevar el estudio? No tenés que hacer nada, el cupo se libera solo.
</p>

<p style="font-size:13px; color:#777; line-height:1.7;">
  ¿Algún problema? Escribinos a
  <a href="mailto:soporte@theosplace.org" style="color:#3B7579;">soporte@theosplace.org</a>.
</p>`
}

async function main() {
  console.log(ENVIAR ? '⚠️  ENVIANDO DE VERDAD\n' : '🔍 DRY-RUN — no manda nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const { rows } = await c.query<{
    persona: string; nombre: string; correo: string | null; estudio: string
    monto: string; rebotado: boolean
  }>(`
    select m.first_name||' '||m.last_name persona, m.first_name nombre, m.email correo,
           coalesce(pl.name, g.name, 'tu estudio') estudio, p.amount monto,
           m.email_bounced rebotado
    from study_enrollments e
    join members m on m.id = e.member_id
    join payments p on p.enrollment_id = e.id and p.concept = 'matricula'
    left join study_groups g on g.id = e.group_id
    left join study_plans pl on pl.id = g.plan_id
    where e.status = 'pendiente_de_pago' and p.status = 'pending' and p.review_status is null
    order by m.first_name`)

  const { formatMoney } = await import('../../src/lib/format')
  const { instruccionesHtml, detalleSugerido } = await import('../../src/lib/finance/payment-instructions')
  const { renderEmail } = await import('../../src/lib/email/baseLayout')
  const { sendEmail } = await import('../../src/lib/email/provider')

  const enviables = rows.filter(r => r.correo && !r.rebotado)
  const sinCorreo = rows.filter(r => !r.correo || r.rebotado)

  console.log(`matrículas sin comprobante: ${rows.length}`)
  for (const r of enviables) console.log(`  ✓ ${r.persona.padEnd(30)} ${r.estudio.padEnd(28)} ${formatMoney(Number(r.monto), 'CRC')}  →  ${r.correo}`)
  for (const r of sinCorreo) console.log(`  ⚠ ${r.persona.padEnd(30)} ${r.rebotado ? 'correo rebotado' : 'sin correo'} — hay que avisarle por WhatsApp`)

  if (!ENVIAR) { console.log(`\n(dry-run) mandaría ${enviables.length} correos. Correlo con --enviar.`); await c.end(); return }

  console.log('\n── enviando ──')
  let ok = 0
  for (const r of enviables) {
    const monto = formatMoney(Number(r.monto), 'CRC')
    const html = renderEmail(cuerpo(
      r.nombre, r.estudio, monto,
      instruccionesHtml(detalleSugerido(r.estudio, r.persona)),
    ))
    try {
      await sendEmail({
        to: { email: r.correo!, name: r.persona },
        subject: `Falta tu comprobante para confirmar la matrícula en ${r.estudio}`,
        html,
        kind: 'transactional',
      })
      console.log(`  ✓ ${r.persona}`)
      ok++
    } catch (e) {
      console.log(`  ✗ ${r.persona}: ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`\n  enviados: ${ok}/${enviables.length}`)
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
