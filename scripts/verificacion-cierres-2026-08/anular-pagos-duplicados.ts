/**
 * Pagos registrados dos veces con el MISMO comprobante.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/anular-pagos-duplicados.ts
 *   aplicar:  ... --aplicar
 *
 * La referencia SINPE identifica una transacción bancaria: si aparece dos
 * veces en pagos distintos de la misma persona, es el mismo dinero contado
 * dos veces, no dos pagos.
 *
 *   Johnny Leandro  ₡20.000 · ref 2026083110284000493925369 · Romanos
 *     Subió el comprobante dos veces con 5 minutos de diferencia, sobre la
 *     MISMA inscripción. El sistema aceptó los dos.
 *
 *   Lilliam Salas   ₡5.000 · ref 406491888 · Sirviendo como Jesús
 *     Subió el mismo comprobante en las dos inscripciones al trasladarse de
 *     grupo (de Stanley Benavides a Hilda Díaz).
 *
 * QUÉ SE HACE. Se deja UN pago vivo y el duplicado se marca 'cancelado' con
 * el motivo escrito. No se borra: el rastro de que existió y por qué se anuló
 * vale más que la fila limpia.
 *
 * CUÁL SE DEJA. El de la inscripción que sigue activa. Si las dos están en la
 * misma inscripción (el caso de Johnny), se deja el primero: es el que la
 * persona subió, el segundo fue el reintento.
 */
import { Client } from 'pg'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')
const MOTIVO = 'Registro duplicado: el mismo comprobante quedó cargado dos veces. El dinero entró una sola vez.'

async function main() {
  console.log(APLICAR ? '⚠️  APLICANDO\n' : '🔍 DRY-RUN — no cambia nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const { rows: grupos } = await c.query<{ member_id: string; persona: string; reference_code: string; veces: string }>(`
    select p.member_id, m.first_name||' '||m.last_name persona, p.reference_code, count(*)::text veces
    from payments p join members m on m.id = p.member_id
    where p.reference_code is not null and p.status = 'paid'
    group by 1,2,3 having count(*) > 1`)

  if (grupos.length === 0) { console.log('No hay referencias repetidas.'); await c.end(); return }

  const aAnular: Array<{ id: string; persona: string; monto: string; estudio: string }> = []
  for (const g of grupos) {
    // Ordenados: primero los de una inscripción VIVA, después por antigüedad.
    // El primero de la lista se queda; el resto se anula.
    const { rows: pagos } = await c.query<{
      id: string; amount: string; estudio: string; matricula: string | null; creado: string
    }>(`
      select p.id, p.amount, coalesce(pl.name, g.name, '(sin grupo)') estudio,
             e.status matricula, p.created_at::text creado
      from payments p
      left join study_enrollments e on e.id = p.enrollment_id
      left join study_groups g on g.id = e.group_id
      left join study_plans pl on pl.id = g.plan_id
      where p.member_id = $1 and p.reference_code = $2 and p.status = 'paid'
      order by (e.status in ('enrolled','completed','pendiente_de_pago')) desc, p.created_at`,
      [g.member_id, g.reference_code])

    console.log(`${g.persona} · ref ${g.reference_code} · ${g.veces} registros`)
    pagos.forEach((p, i) => {
      const accion = i === 0 ? '✅ se queda' : '🚫 se anula'
      console.log(`   ${accion}  ₡${Number(p.amount).toLocaleString('es-CR')} · ${p.estudio} · matrícula ${p.matricula ?? '—'} · ${p.creado.slice(0, 19)}`)
      if (i > 0) aAnular.push({ id: p.id, persona: g.persona, monto: p.amount, estudio: p.estudio })
    })
    console.log()
  }

  const total = aAnular.reduce((s, a) => s + Number(a.monto), 0)
  console.log(`Se anularían ${aAnular.length} registro(s) · ₡${total.toLocaleString('es-CR')} que nunca entraron dos veces`)

  if (!APLICAR) { console.log('\n(dry-run) Correlo con --aplicar.'); await c.end(); return }

  await c.query('begin')
  try {
    for (const a of aAnular) {
      await c.query(
        `update payments set status = 'cancelado', rejection_reason = $2, updated_at = now()
         where id = $1 and status = 'paid'`, [a.id, MOTIVO])
      console.log(`  ✓ ${a.persona} — ₡${Number(a.monto).toLocaleString('es-CR')} (${a.estudio})`)
    }
    await c.query('commit')
    console.log(`\n  ✅ ${aAnular.length} duplicado(s) anulado(s)`)
  } catch (e) {
    await c.query('rollback')
    console.error('❌ rollback:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
