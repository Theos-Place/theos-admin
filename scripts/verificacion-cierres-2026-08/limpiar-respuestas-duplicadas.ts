/**
 * Respuestas de formulario guardadas dos veces por un doble clic.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/limpiar-respuestas-duplicadas.ts
 *   aplicar:  ... --aplicar
 *
 * Medido el 2026-09-03: 7 de 61 respuestas eran duplicados, TODOS con 0 o 1
 * segundo de diferencia. No era gente respondiendo dos veces — era el mismo
 * envío contado doble: el botón no se deshabilitaba y el POST no validaba
 * `hasMemberResponded`. Las dos cosas ya están arregladas; esto limpia lo que
 * quedó.
 *
 * QUÉ SE BORRA. La respuesta MÁS NUEVA de cada par, con sus valores. Se deja
 * la primera: es la que la persona envió, la segunda fue el rebote. Solo se
 * tocan pares de la misma persona en el mismo formulario y con menos de 60
 * segundos entre medio — un envío legítimo dos días después no es esto.
 *
 * Los formularios que permiten varias respuestas (allow_multiple_responses)
 * quedan fuera: ahí dos respuestas son válidas por diseño.
 */
import { Client } from 'pg'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/** Dos envíos separados por más de esto no son un doble clic. */
const SEGUNDOS_MAX = 60

async function main() {
  console.log(APLICAR ? '⚠️  APLICANDO\n' : '🔍 DRY-RUN — no borra nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const { rows } = await c.query<{
    id: string; persona: string; formulario: string; segundos: number
    valores: string; queda_id: string; valores_queda: string
  }>(`
    with pares as (
      select r.id, r.member_id, r.form_id, r.submitted_at,
        first_value(r.id) over w queda_id,
        extract(epoch from (r.submitted_at - first_value(r.submitted_at) over w))::int segundos,
        row_number() over w rn
      from form_responses r
      join forms f on f.id = r.form_id
      where r.member_id is not null and coalesce(f.allow_multiple_responses, false) = false
      window w as (partition by r.form_id, r.member_id order by r.submitted_at)
    )
    select p.id, m.first_name||' '||m.last_name persona, f.title formulario, p.segundos,
      (select count(*)::text from form_response_values v where v.response_id = p.id) valores,
      p.queda_id,
      (select count(*)::text from form_response_values v where v.response_id = p.queda_id) valores_queda
    from pares p
    join members m on m.id = p.member_id
    join forms f on f.id = p.form_id
    where p.rn > 1 and p.segundos <= ${SEGUNDOS_MAX}
    order by f.title, m.first_name`)

  if (rows.length === 0) { console.log('No hay duplicados que limpiar.'); await c.end(); return }

  for (const r of rows) {
    // Si la copia tiene MÁS respuestas que la original, algo no es un simple
    // rebote: se avisa para que alguien lo mire en vez de borrar a ciegas.
    const alerta = Number(r.valores) > Number(r.valores_queda) ? '  ⚠️ la copia tiene MÁS valores' : ''
    console.log(`  ${r.persona.padEnd(34)} ${r.formulario}`)
    console.log(`     +${r.segundos}s · se borra la copia (${r.valores} valores), queda la original (${r.valores_queda})${alerta}`)
  }
  console.log(`\n${rows.length} duplicado(s)`)

  const sospechosos = rows.filter(r => Number(r.valores) > Number(r.valores_queda))
  if (sospechosos.length > 0) {
    console.log(`\n⚠️  ${sospechosos.length} copia(s) con más valores que la original — revisar antes de borrar.`)
    if (APLICAR) { console.log('   No se borra nada hasta que se revisen.'); await c.end(); process.exit(1) }
  }

  if (!APLICAR) { console.log('\n(dry-run) Correlo con --aplicar.'); await c.end(); return }

  await c.query('begin')
  try {
    const ids = rows.map(r => r.id)
    const v = await c.query(`delete from form_response_values where response_id = any($1::uuid[])`, [ids])
    const r = await c.query(`delete from form_responses where id = any($1::uuid[])`, [ids])
    await c.query('commit')
    console.log(`\n  ✅ ${r.rowCount} respuesta(s) y ${v.rowCount} valor(es) borrados`)
  } catch (e) {
    await c.query('rollback')
    console.error('❌ rollback:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
