const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const ARCHIVO = 'supabase/migrations/20260916200000_donante_activo_seis_meses.sql'
const aplicar = process.argv.includes('--aplicar')
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const antes = await c.query(`select count(*) n from members where is_donor`)
    await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
    const despues = await c.query(`select count(*) n from members where is_donor`)
    console.log(`donantes antes: ${antes.rows[0].n} · después: ${despues.rows[0].n}`)

    // La bandera tiene que coincidir EXACTAMENTE con la nueva ventana.
    const mal = await c.query(`
      select
        (select count(*) from members m where m.is_donor and not exists (
          select 1 from donations d where d.member_id=m.id
            and d.donation_date >= (date_trunc('month', current_date) - interval '5 months')::date)) as marcados_de_mas,
        (select count(*) from (select distinct d.member_id from donations d join members m on m.id=d.member_id
          where d.donation_date >= (date_trunc('month', current_date) - interval '5 months')::date
            and not m.is_donor) x) as marcados_de_menos`)
    console.log('  marcados de más: ' + mal.rows[0].marcados_de_mas + ' · de menos: ' + mal.rows[0].marcados_de_menos)
    if (Number(mal.rows[0].marcados_de_mas) || Number(mal.rows[0].marcados_de_menos)) throw new Error('GUARDA: la bandera no coincide con la ventana')

    if (aplicar) {
      await c.query(`insert into supabase_migrations.schema_migrations (version, name) values ('20260916200000','donante_activo_seis_meses') on conflict do nothing`)
      await c.query('commit'); console.log('\n>>> APLICADA y registrada')
    } else { await c.query('rollback'); console.log('\n>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()
