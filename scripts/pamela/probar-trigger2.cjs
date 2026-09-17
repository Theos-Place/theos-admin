/**
 * Prueba las tres guardas del nuevo log_changes() contra la base real.
 * Todo dentro de una transacción con rollback: no queda nada.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')
const MIGRACION = 'supabase/migrations/20260917000000_audit_log_sin_subtransaccion.sql'
const aplicar = process.argv.includes('--aplicar')
const VERSION = '20260917000000'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    await c.query(fs.readFileSync(MIGRACION, 'utf8'))

    // Un usuario real de auth.users y una fila inofensiva para tocar.
    const u = await c.query(`select id from auth.users limit 1`)
    const USER = u.rows[0].id
    const b = await c.query(`select id, notes from scholarships limit 1`)
    const BECA = b.rows[0].id

    const probar = async (nombre, headers, claims) => {
      await c.query(`select set_config('request.headers', $1, true)`, [headers ?? ''])
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [claims ?? ''])
      // Se limpian las filas de auditoría de esta beca ANTES de cada caso:
      // dentro de una transacción `now()` es constante, así que ordenar por
      // created_at no distingue una fila de otra. (Esto se descubrió acá mismo:
      // el primer test daba null en el camino bueno por leer la fila de otro
      // caso, no porque el trigger fallara.)
      await c.query(`delete from audit_log where entity_id=$1`, [BECA])
      let error = null
      try {
        await c.query(`update scholarships set updated_at = now(), notes = coalesce(notes,'') || 'x' where id=$1`, [BECA])
      } catch (e) { error = e.message }
      const r = await c.query(`select actor_id from audit_log where entity_id=$1`, [BECA])
      if (r.rowCount !== 1) throw new Error(`${nombre}: esperaba 1 fila de auditoría, hay ${r.rowCount}`)
      const actor = r.rows[0]?.actor_id ?? null
      console.log(`  ${nombre.padEnd(52)} ${error ? 'ESCRITURA ROTA: '+error : 'actor=' + (actor ?? 'null')}`)
      return { actor, error }
    }

    console.log('=== GUARDA 3: un header malo no puede tumbar la escritura ===')
    const a = await probar('header basura ("pepe")', JSON.stringify({ 'x-actor-user-id': 'pepe' }), JSON.stringify({ role: 'service_role' }))
    const b2 = await probar('request.headers que ni es JSON', 'esto no es json', JSON.stringify({ role: 'service_role' }))
    const c3 = await probar('uuid bien formado pero inexistente', JSON.stringify({ 'x-actor-user-id': '00000000-0000-4000-8000-000000000000' }), JSON.stringify({ role: 'service_role' }))

    console.log('\n=== GUARDA 2: solo el rol de servicio puede declarar el actor ===')
    const d = await probar('uuid real pero rol anon (intento de falsificar)', JSON.stringify({ 'x-actor-user-id': USER }), JSON.stringify({ role: 'anon' }))
    const e = await probar('uuid real y sin claims', JSON.stringify({ 'x-actor-user-id': USER }), null)

    console.log('\n=== EL CAMINO BUENO ===')
    const f = await probar('uuid real + rol de servicio', JSON.stringify({ 'x-actor-user-id': USER }), JSON.stringify({ role: 'service_role' }))

    console.log('\n=== SIN HEADER: se comporta como hoy ===')
    const g = await probar('sin nada', null, null)

    const fallas = []
    for (const [n, r] of [['basura',a],['no-json',b2],['inexistente',c3],['anon',d],['sin claims',e],['sin nada',g]]) {
      if (r.error) fallas.push(`${n}: rompió la escritura`)
      if (r.actor !== null) fallas.push(`${n}: guardó actor y no debía (${r.actor})`)
    }
    if (f.error) fallas.push('camino bueno: rompió la escritura')
    if (f.actor !== USER) fallas.push(`camino bueno: no guardó el actor (${f.actor})`)
    if (fallas.length) throw new Error('FALLÓ:\n  - ' + fallas.join('\n  - '))
    console.log('\n>>> las 3 guardas funcionan')

    if (aplicar) {
      await c.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1,$2) on conflict do nothing`,
        [VERSION, 'audit_log_sin_subtransaccion'])
      // Se revierten los updates de prueba pero NO la función: se reaplica limpia.
      await c.query('rollback'); await c.query(fs.readFileSync(MIGRACION, 'utf8'))
      await c.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1,$2) on conflict do nothing`,
        [VERSION, 'audit_log_sin_subtransaccion'])
      console.log('>>> APLICADA y registrada (los updates de prueba se revirtieron)')
    } else { await c.query('rollback'); console.log('>>> DRY-RUN: rollback') }
  } catch (e) { await c.query('rollback'); console.error('\nROLLBACK:', e.message); process.exitCode = 1 }
  finally { await c.end() }
})()
