/**
 * Aplica la regla nueva de arranque a los sucesores que ya existían.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/aplicar-fechas-nuevas-sucesores.ts
 *   aplicar:  ... --aplicar
 *
 * Estos grupos nacieron con la regla vieja (arrancar donde terminó el anterior)
 * y quedaron empezando el mismo día del cierre — antes de que llegaran sus
 * folletos, que tardan 8 días. La regla nueva los pone en el primer día de
 * clase que caiga a 8 días o más del cierre.
 *
 * El cálculo sale de `fechasDelSucesor`, la MISMA función que usa el cierre:
 * lo que se aplica acá es exactamente lo que producirá de aquí en adelante.
 *
 * A QUIÉNES. Solo los sucesores que salieron de un cierre registrado — se
 * identifican por el tiquete de folletos que los enlaza con su grupo de origen.
 * Un grupo creado a mano no se toca: su fecha la puso alguien a propósito.
 */
import { Client } from 'pg'
import { cargarEnv } from './lib'
import { fechasDelSucesor } from '../../src/lib/studies/successor-dates'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const conDia = (ymd: string) => `${ymd} (${DIAS[new Date(`${ymd}T00:00:00Z`).getUTCDay()]})`

async function main() {
  console.log(APLICAR ? '⚠️  APLICANDO\n' : '🔍 DRY-RUN — no cambia nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const { rows } = await c.query<{
    id: string; name: string; starts_at: string; ends_at: string | null
    schedule_days: string[] | null; semanas: number | null
    cierre: string; fin_origen: string | null; matriculados: string; listos: string
  }>(`
    select g.id, g.name, g.starts_at::text starts_at, g.ends_at::text ends_at,
           g.schedule_days, p.duration_weeks semanas,
           f.close_date::text cierre, f.available_at::text listos,
           go.ends_at::text fin_origen,
           (select count(*) from study_enrollments e
            where e.group_id = g.id and e.status in ('enrolled','pendiente_de_pago')) matriculados
    from folleto_requests f
    join study_groups g on g.id = f.source_group_id
    join study_plans p on p.id = g.plan_id
    join study_groups go on go.id = f.origin_group_id
    where f.origin_group_id is not null
    order by f.close_date`)

  const cambios: Array<{ id: string; name: string; starts: string; ends: string | null }> = []
  for (const r of rows) {
    const nuevo = fechasDelSucesor({
      finDelAnterior: r.fin_origen,
      semanas: r.semanas,
      hoy: r.cierre.slice(0, 10),
      diasDeClase: r.schedule_days,
    })
    if (nuevo.starts_at === r.starts_at.slice(0, 10)) continue
    console.log(`${r.name}  ·  ${r.matriculados} matriculados`)
    console.log(`   se cerró  ${conDia(r.cierre.slice(0, 10))} · clases ${r.schedule_days?.join(', ') ?? '(sin días)'}`)
    console.log(`   inicio    ${conDia(r.starts_at.slice(0, 10))}  →  ${conDia(nuevo.starts_at)}`)
    console.log(`   fin       ${r.ends_at?.slice(0, 10) ?? '—'}  →  ${nuevo.ends_at ?? '—'}`)
    console.log(`   folletos  llegan el ${r.listos.slice(0, 10)}${nuevo.starts_at >= r.listos.slice(0, 10) ? ' ✅ antes de arrancar' : ' ⚠️ después de arrancar'}\n`)
    cambios.push({ id: r.id, name: r.name, starts: nuevo.starts_at, ends: nuevo.ends_at })
  }

  if (cambios.length === 0) { console.log('Todos ya cumplen la regla.'); await c.end(); return }
  if (!APLICAR) { console.log(`(dry-run) ${cambios.length} grupo(s). Correlo con --aplicar.`); await c.end(); return }

  await c.query('begin')
  try {
    for (const ch of cambios) {
      await c.query(
        `update study_groups set starts_at = $2, ends_at = $3, updated_at = now() where id = $1`,
        [ch.id, ch.starts, ch.ends],
      )
      console.log(`  ✓ ${ch.name}`)
    }
    await c.query('commit')
    console.log(`\n  ✅ actualizados: ${cambios.length}`)
  } catch (e) {
    await c.query('rollback')
    console.error('❌ rollback:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
