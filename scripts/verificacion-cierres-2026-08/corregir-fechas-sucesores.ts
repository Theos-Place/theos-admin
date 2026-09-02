/**
 * Sucesores que nacieron arrancando en el pasado.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/corregir-fechas-sucesores.ts
 *   aplicar:  ... --aplicar
 *
 * POR QUÉ. La regla vieja hacía que el grupo sucesor arrancara donde terminó
 * el anterior. Cuando el cierre se hace tarde, eso da una fecha ya vencida: el
 * N4 de Jhonny Leandro nació el 1 de setiembre "empezando" el 10 de agosto.
 * La regla ya está corregida (successor-dates: el arranque nunca queda antes
 * del día del cierre), esto arregla los grupos que quedaron con la fecha vieja.
 *
 * QUÉ TOCA. `starts_at` pasa al día en que el grupo se creó —que es el día del
 * cierre— y `ends_at` se recalcula desde ahí con la misma regla, así que el
 * período conserva su duración y la semana de vacaciones. Mover el fin importa
 * más de lo que parece: de él sale el recordatorio de cierre.
 *
 * A QUIÉNES. Solo grupos con el prefijo de sucesor ("N4 · ", "DIS2 · ") cuya
 * fecha de arranque es anterior a su propia creación. Los grupos creados a mano
 * con fecha retroactiva no llevan ese prefijo y quedan fuera: ahí la fecha
 * pasada es intencional.
 */
import { Client } from 'pg'
import { cargarEnv } from './lib'
import { fechasDelSucesor } from '../../src/lib/studies/successor-dates'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  console.log(APLICAR ? '⚠️  APLICANDO\n' : '🔍 DRY-RUN — no cambia nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const { rows } = await c.query<{
    id: string; name: string; inicio: string; fin: string | null
    creado: string; semanas: number | null; matr: string
  }>(`
    select g.id, g.name, g.starts_at::text inicio, g.ends_at::text fin,
           g.created_at::date::text creado, p.duration_weeks semanas,
           (select count(*) from study_enrollments e
            where e.group_id = g.id and e.status in ('enrolled','pendiente_de_pago')) matr
    from study_groups g
    join study_plans p on p.id = g.plan_id
    where g.name ~ '^[A-Z0-9]+ · ' and g.created_at::date > g.starts_at
    order by g.created_at desc`)

  if (rows.length === 0) { console.log('No hay grupos con la fecha vieja.'); await c.end(); return }

  const cambios: Array<{ id: string; name: string; starts: string; ends: string | null }> = []
  for (const r of rows) {
    // El día del cierre = el día en que se creó el sucesor.
    const n = fechasDelSucesor({ finDelAnterior: r.inicio, semanas: r.semanas, hoy: r.creado })
    const dias = Math.round((Date.parse(n.starts_at) - Date.parse(r.inicio.slice(0, 10))) / 86_400_000)
    console.log(`${r.name}`)
    console.log(`  inicio  ${r.inicio.slice(0, 10)} → ${n.starts_at}   (+${dias} días)`)
    console.log(`  fin     ${r.fin?.slice(0, 10) ?? '—'} → ${n.ends_at ?? '—'}`)
    console.log(`  ${r.matr} matriculados · plan de ${r.semanas ?? '?'} semanas\n`)
    cambios.push({ id: r.id, name: r.name, starts: n.starts_at, ends: n.ends_at })
  }

  if (!APLICAR) { console.log(`(dry-run) ${cambios.length} grupo(s). Correlo con --aplicar.`); await c.end(); return }

  // Todo o nada: quedar a medias dejaría unos grupos con la regla nueva y
  // otros con la vieja, que es peor que no haber empezado.
  await c.query('begin')
  try {
    let n = 0
    for (const ch of cambios) {
      const r = await c.query(
        `update study_groups set starts_at = $2, ends_at = $3, updated_at = now()
         where id = $1 returning id`,
        [ch.id, ch.starts, ch.ends],
      )
      if (r.rowCount) { console.log(`  ✓ ${ch.name}`); n++ }
    }
    await c.query('commit')
    console.log(`\n  corregidos: ${n}/${cambios.length}`)
  } catch (e) {
    await c.query('rollback')
    console.error('❌ rollback:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
