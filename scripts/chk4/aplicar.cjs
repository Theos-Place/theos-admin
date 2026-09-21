/** CHK-4 · Aplica la columna del comité del subevento y hace el backfill. */
const fs = require('fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const ARCHIVO = 'supabase/migrations/20260921180000_chk4_comite_del_subevento.sql'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const col = await c.query(`select data_type, is_nullable from information_schema.columns
      where table_name='sub_events' and column_name='committee_id'`)
    console.log('columna:', col.rows[0])
    if (!col.rows.length) throw new Error('la columna no quedó')

    // Backfill: los 4 subeventos existentes se llaman "Youth" y los opera el
    // Comité Youth, que es transversal a las sedes (ver comite-de-la-charla.ts).
    const r = await c.query(`
      update sub_events se set committee_id = a.id
      from areas a
      where a.area_type='committee' and a.is_active
        and lower(unaccent(a.name)) = 'comite youth'
        and lower(unaccent(se.name)) = 'youth'
        and se.committee_id is null`)
    console.log(`subeventos con comité asignado: ${r.rowCount}`)

    const v = await c.query(`select se.name subevento, e.title evento, a.name comite
      from sub_events se join events e on e.id=se.event_id
      left join areas a on a.id=se.committee_id order by e.starts_at desc`)
    console.table(v.rows)
    const sin = v.rows.filter(x => !x.comite).length
    console.log(`subeventos sin comité: ${sin}`)

    await c.query(`insert into supabase_migrations.schema_migrations (version, name)
      values ('20260921180000', $1) on conflict do nothing`, [ARCHIVO.split('/').pop()])
    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
