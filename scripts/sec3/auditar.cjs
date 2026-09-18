/**
 * SEC-3 · ¿Quedó alguna función de `public` ejecutable sin sesión?
 *
 * Se corre a mano contra producción (los tests del repo no tocan la base). La
 * respuesta correcta es CERO: el 2026-09-17 había dos —el reporte de charlas y
 * la resolución por external_id— y con la llave pública del navegador se podía
 * sacar la asistencia de toda la organización.
 *
 *   node scripts/sec3/auditar.cjs
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = await nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon_puede,
           not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) cfg
                       where cfg like 'search_path=%') as sin_search_path
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
    order by p.proname`)

  const abiertas = rows.filter(r => r.anon_puede && r.prosecdef)
  const sinPath = rows.filter(r => r.sin_search_path)
  console.log(`funciones en public: ${rows.length}`)
  console.log(`  SECURITY DEFINER ejecutables por anon: ${abiertas.length}`)
  abiertas.forEach(r => console.log(`     ‼ ${r.proname}(${r.args})  → revoke execute from public, anon, authenticated`))
  console.log(`  sin search_path fijo: ${sinPath.length}`)
  sinPath.forEach(r => console.log(`     ‼ ${r.proname}(${r.args})  → alter function ... set search_path to 'public'`))
  await c.end()
  if (abiertas.length || sinPath.length) process.exit(1)
  console.log('\n✓ nada abierto')
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
