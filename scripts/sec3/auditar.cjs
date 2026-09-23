/**
 * SEC-3 · ¿Quedó alguna función de `public` ejecutable sin sesión?
 *
 * Se corre a mano contra producción (los tests del repo no tocan la base). La
 * respuesta correcta es CERO: el 2026-09-17 había dos —el reporte de charlas y
 * la resolución por external_id— y con la llave pública del navegador se podía
 * sacar la asistencia de toda la organización.
 *
 *   node scripts/sec3/auditar.cjs
 *
 * AMPLIADO (INF-1, 2026-09-22). Antes solo miraba las SECURITY DEFINER —que son
 * las que escalan privilegios— y por eso no vio `merge_members_resuelto`, que
 * NO lo es y aun así tenía `GRANT ALL ... TO anon, authenticated` escrito en su
 * propia migración. No era explotable (corre con los permisos de quien llama, y
 * RLS le bloquea todas las escrituras a un miembro cualquiera), pero es lo que
 * la regla de AGENTS.md prohíbe, y el día que alguien afloje una política deja
 * de ser inofensivo.
 *
 * Apareció levantando la primera base desde cero para staging, no auditando
 * producción: en el esquema en blanco era la única función con ese grant.
 * Ahora se revisan TODAS, con dos niveles de gravedad.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  const c = await nuevoCliente(); await c.connect()
  const { rows } = await c.query(`
    select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon_puede,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_puede,
           not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) cfg
                       where cfg like 'search_path=%') as sin_search_path
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
    order by p.proname`)

  // Gravísimo: escala privilegios sin sesión.
  const abiertas = rows.filter(r => r.anon_puede && r.prosecdef)
  // Grave igual: la regla es que NINGUNA función de public quede con EXECUTE
  // para anon o authenticated, sea definer o no. La convención del esquema ya
  // es ésa —al 2026-09-22 el total es cero—, así que cualquiera que aparezca
  // es un descuido, no un caso legítimo.
  const concedidas = rows.filter(r => (r.anon_puede || r.auth_puede) && !r.prosecdef)
  const sinPath = rows.filter(r => r.sin_search_path)
  console.log(`funciones en public: ${rows.length}`)
  console.log(`  SECURITY DEFINER ejecutables por anon: ${abiertas.length}`)
  abiertas.forEach(r => console.log(`     ‼ ${r.proname}(${r.args})  → revoke execute from public, anon, authenticated`))
  console.log(`  con EXECUTE para anon/authenticated (sin ser definer): ${concedidas.length}`)
  concedidas.forEach(r => console.log(`     ‼ ${r.proname}(${r.args})  → revoke execute from public, anon, authenticated`))
  console.log(`  sin search_path fijo: ${sinPath.length}`)
  sinPath.forEach(r => console.log(`     ‼ ${r.proname}(${r.args})  → alter function ... set search_path to 'public'`))
  await c.end()
  if (abiertas.length || concedidas.length || sinPath.length) process.exit(1)
  console.log('\n✓ nada abierto')
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
