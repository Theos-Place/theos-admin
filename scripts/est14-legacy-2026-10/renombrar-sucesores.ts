/**
 * Los grupos sucesores que se quedaron con el mes del grupo ORIGEN.
 *
 *   dry-run:  npx tsx scripts/est14-legacy-2026-10/renombrar-sucesores.ts
 *   aplicar:  ... --aplicar
 *
 * EL CASO (2026-10-05): llegaron los correos de folletos diciendo «Julio» en
 * octubre. El nombre del sucesor heredaba el del origen cambiándole solo el
 * nivel, así que un grupo de Nivel 4 que arranca el 11 de octubre se llamaba
 * «Nivel 4. Michelle Guier. Julio 2026». La regla ya quedó arreglada en
 * `successor-name.ts`; esto corrige los que ya existen.
 *
 * ALCANCE: TODOS LOS GRUPOS ACTIVOS (Floriana, 2026-10-05). Primero se
 * corrigieron solo los 6 sucesores del día, dejando los otros 25 por si el
 * mes del nombre era deliberado —la cohorte se nombra por cuándo empezó el
 * grupo original—. No lo es: el nombre tiene que decir cuándo arranca ESTE
 * grupo, porque es lo que leen el dirigente, el que imprime los folletos y
 * quien se matricula.
 *
 * NO se tocan los FINALIZADOS. Esos ya pasaron y su nombre es el registro de
 * lo que fue; corregirlo ahora reescribe historia que nadie va a volver a
 * leer, y son muchos más.
 *
 * Los nombres viejos quedan impresos para poder revertir.
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { conElMesDelInicio } from '@/lib/studies/successor-name'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)![1]
const c = new Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
})
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  await c.connect()
  const { rows } = await c.query(`
    select g.id, g.name, p.code nivel, g.status,
           (g.starts_at at time zone 'America/Costa_Rica')::date::text inicio
      from study_groups g join study_plans p on p.id = g.plan_id
     where g.starts_at is not null
       and g.status in ('en_matricula', 'en_curso')
     order by p.code, g.name`)

  const cambios = rows
    .map(g => ({ ...g, nuevo: conElMesDelInicio(g.name, g.inicio) }))
    .filter(g => g.nuevo !== g.name)

  console.log(`${rows.length} grupos activos con fecha de arranque; `
    + `${cambios.length} con el mes equivocado${APLICAR ? '' : '  (DRY RUN)'}\n`)
  for (const g of cambios) {
    console.log(`  ${g.nivel.padEnd(7)} arranca ${g.inicio}  ${g.status}`)
    console.log(`    antes:   ${g.name}`)
    console.log(`    después: ${g.nuevo}`)
    console.log(`    rollback: update study_groups set name = ${JSON.stringify(g.name)} where id = '${g.id}';`)
  }
  if (!APLICAR) { console.log('\nPara aplicar: --aplicar'); await c.end(); return }

  await c.query('begin')
  try {
    for (const g of cambios) {
      await c.query('update study_groups set name = $2 where id = $1', [g.id, g.nuevo])
    }
    await c.query('commit')
    console.log(`\n✓ ${cambios.length} renombrados`)
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })
