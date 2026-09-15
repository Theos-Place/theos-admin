/**
 * REPARACIÓN · Devolverle a Steven Angulo los 47 check-ins que la fusión
 * de hoy absorbió en la ficha de Karen.
 *   npx tsx --env-file=.env.local scripts/karen-steven-2026-09-15/restaurar-steven.cjs [--aplicar]
 *
 * QUÉ HICE MAL. La ficha que llevaba el external_id 19437 se llamaba "Karen
 * Patricia" pero el id es de Steven, así que el import histórico de asistencia
 * —que matchea por external_id— le cargó AHÍ los check-ins de Steven. Cuando
 * fusioné las dos fichas de Karen, esos 47 quedaron como duplicados de los de
 * ella (van juntos a las charlas, mismas fechas) y el dedup los borró.
 *
 * Mirar solo el event_id no alcanzaba para distinguirlos. El nombre sí: en
 * data-import/asistencia-detalle-2020-2026.csv la fila trae el nombre de la
 * persona, y las 47 de 19437 dicen "Angulo Jimenez, Steven".
 *
 * El evento de cada fila se toma del check-in que Karen conserva en esa MISMA
 * fecha —fueron juntos— en vez de re-derivarlo del título: el mapeo
 * grupo→evento del import original ya resolvió las series y los renombres, y
 * rehacerlo a mano es la vía directa a inventar un evento equivocado.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')
  const uno = async (s, p) => (await c.query(s, p)).rows[0]

  const steven = await uno(`select id, first_name||' '||last_name p from members where external_id='19437'`)
  const karen  = await uno(`select id, first_name||' '||last_name p from members where external_id='19438'`)
  console.log(`Steven: ${steven.p}\nKaren:  ${karen.p}\n`)

  // Filas del CSV que dicen "Angulo Jimenez, Steven".
  const filas = fs.readFileSync('data-import/asistencia-detalle-2020-2026.csv', 'utf8')
    .split('\n').filter(l => l.startsWith('19437,'))
    .map(l => { const p = l.split(','); return { fecha: p[p.length - 2], grupo: p[p.length - 3] } })
  console.log(`filas de Steven en el CSV: ${filas.length}`)

  // Los check-ins que Karen conserva, por fecha.
  const { rows: deKaren } = await c.query(`
    select ec.event_id, ec.sub_event_id, ec.checked_in_at, ec.checked_in_as,
           (ec.checked_in_at at time zone 'America/Costa_Rica')::date::text d, e.title
    from event_checkins ec join events e on e.id = ec.event_id where ec.member_id = $1`, [karen.id])
  const porFecha = new Map()
  for (const r of deKaren) {
    if (!porFecha.has(r.d)) porFecha.set(r.d, [])
    porFecha.get(r.d).push(r)
  }

  const aCrear = [], sinPareja = [], ambiguas = []
  for (const f of filas) {
    const cands = porFecha.get(f.fecha) ?? []
    if (cands.length === 0) { sinPareja.push(f); continue }
    if (cands.length > 1) { ambiguas.push({ ...f, cands: cands.map(x => x.title) }); continue }
    aCrear.push({ ...f, ...cands[0] })
  }
  console.log(`  con evento identificado: ${aCrear.length}`)
  console.log(`  sin check-in de Karen esa fecha: ${sinPareja.length}`)
  console.log(`  ambiguas (Karen fue a 2 eventos ese día): ${ambiguas.length}`)
  ambiguas.forEach(a => console.log(`     ${a.fecha} · CSV dice "${a.grupo}" · Karen tiene: ${a.cands.join(' | ')}`))
  sinPareja.forEach(a => console.log(`     sin pareja: ${a.fecha} · ${a.grupo}`))

  if (aCrear.length) {
    await c.query(`
      insert into event_checkins (member_id, event_id, sub_event_id, checked_in_at, checked_in_as)
      select $1, x.event_id, x.sub_event_id, x.checked_in_at, x.checked_in_as
      from jsonb_to_recordset($2::jsonb) as x(event_id uuid, sub_event_id uuid, checked_in_at timestamptz, checked_in_as text)
      on conflict do nothing`,
      [steven.id, JSON.stringify(aCrear.map(r => ({
        event_id: r.event_id, sub_event_id: r.sub_event_id,
        checked_in_at: r.checked_in_at, checked_in_as: r.checked_in_as ?? 'asistente',
      })))])
  }

  const fin = await uno(`select count(*)::int n from event_checkins where member_id=$1`, [steven.id])
  const finK = await uno(`select count(*)::int n from event_checkins where member_id=$1`, [karen.id])
  console.log(`\nCÓMO QUEDA:  Steven ${fin.n} check-ins · Karen ${finK.n}`)
  console.log(`   (el CSV dice: Steven 47 · Karen 59 + 3 de la app = 62)`)
  if (fin.n !== filas.length) console.log(`   ⚠️  Steven quedó con ${fin.n} y el CSV dice ${filas.length}`)

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
