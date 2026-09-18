const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const VERSION = '20260917210000'
const ARCHIVO = `supabase/migrations/${VERSION}_sec3_rpcs_cerradas_a_anon.sql`
;(async () => {
  const c = await nuevoCliente(); await c.connect()
  await c.query('begin')
  await c.query(fs.readFileSync(ARCHIVO, 'utf8'))
  // Comprobar DENTRO de la transacción antes de confirmar.
  const { rows } = await c.query(`
    select 'anon' rol, has_function_privilege('anon','public.report_charla_attendance()','EXECUTE') a,
           has_function_privilege('anon','public.member_por_external_id(text)','EXECUTE') b
    union all select 'authenticated',
           has_function_privilege('authenticated','public.report_charla_attendance()','EXECUTE'),
           has_function_privilege('authenticated','public.member_por_external_id(text)','EXECUTE')
    union all select 'service_role',
           has_function_privilege('service_role','public.report_charla_attendance()','EXECUTE'),
           has_function_privilege('service_role','public.member_por_external_id(text)','EXECUTE')`)
  rows.forEach(r => console.log(`  ${r.rol.padEnd(14)} charla=${r.a ? 'SÍ' : 'no'}  external_id=${r.b ? 'SÍ' : 'no'}`))
  const bien = rows.every(r => r.rol === 'service_role' ? (r.a && r.b) : (!r.a && !r.b))
  if (!bien) { await c.query('rollback'); throw new Error('los permisos no quedaron como se esperaba — rollback') }
  const { rows: sp } = await c.query(`
    select coalesce(array_to_string(proconfig,','),'(ninguno)') cfg from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='merge_no_copia'`)
  console.log(`  merge_no_copia: ${sp[0].cfg}`)
  if (!sp[0].cfg.includes('search_path')) { await c.query('rollback'); throw new Error('search_path no quedó — rollback') }
  await c.query(
    `insert into supabase_migrations.schema_migrations (version, name)
     values ($1,$2) on conflict (version) do nothing`, [VERSION, 'sec3_rpcs_cerradas_a_anon'])
  await c.query('commit')
  console.log('\n>>> APLICADO y registrado')
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
