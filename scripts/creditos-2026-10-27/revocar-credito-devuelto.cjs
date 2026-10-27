/**
 * Irene Arias Vargas: su pago de ₡15.000 (Discípulos 1) se DEVOLVIÓ el
 * 2026-10-21, pero el crédito por congelamiento emitido el 2026-10-12 sobre
 * ese mismo pago quedó activo, y por eso seguía en saldos a favor. Floriana
 * (2026-10-27): «es una devolución únicamente». Se revoca el crédito.
 *
 *   node scripts/creditos-2026-10-27/revocar-credito-devuelto.cjs           # medir
 *   node scripts/creditos-2026-10-27/revocar-credito-devuelto.cjs --aplicar
 */
const fs = require('node:fs')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.argv.includes('--aplicar')
const BACKUP = 'docs/correcciones/2026-10-27-irene-arias-credito-revocado-por-devolucion.json'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  // Todo crédito ACTIVO cuyo pago de origen ya se devolvió: la regla general, no solo Irene.
  const { rows } = await c.query(`
    select s.id, s.status, s.discount_value, s.expires_at, s.freeze_reason, s.origin_payment_id,
           m.first_name || ' ' || m.last_name as persona, p.status as pago_status, p.amount, p.updated_at as devuelto_el
      from scholarships s join members m on m.id = s.member_id join payments p on p.id = s.origin_payment_id
     where s.kind = 'credito' and s.status = 'active' and p.status in ('refunded', 'partial_refund')`)
  console.log(`Créditos activos con pago de origen devuelto: ${rows.length}`)
  for (const r of rows) console.log(`  ${r.persona} · crédito ₡${Number(r.discount_value)} · pago ${r.pago_status} el ${r.devuelto_el.toISOString().slice(0, 10)}`)
  if (!APLICAR || rows.length === 0) { if (!APLICAR) console.log('\n(medición; --aplicar para escribir)'); await c.end(); return }

  fs.writeFileSync(BACKUP, JSON.stringify({ fecha: new Date().toISOString(), motivo: 'Crédito revocado: el pago de origen se devolvió (Floriana, 2026-10-27)', antes: rows }, null, 2))
  await c.query('begin')
  try {
    for (const r of rows) {
      const u = await c.query(
        `update scholarships set status = 'revoked', revoked_at = now(),
                revoke_reason = $2
          where id = $1 and status = 'active'`,
        [r.id, `El pago de origen se devolvió el ${r.devuelto_el.toISOString().slice(0, 10)}: es una devolución, no un crédito (Floriana, 2026-10-27).`])
      if (u.rowCount !== 1) throw new Error(`No se pudo revocar ${r.id}`)
      await c.query(`insert into audit_log (action, entity_type, entity_id, old_data, new_data) values ('UPDATE', 'scholarships', $1, $2, $3)`,
        [r.id, { status: 'active' }, { op: 'credito_revocado_por_devolucion', status: 'revoked', persona: r.persona, pago: r.origin_payment_id, script: 'scripts/creditos-2026-10-27/revocar-credito-devuelto.cjs' }])
    }
    await c.query('commit')
  } catch (e) { await c.query('rollback'); throw e }
  console.log('Después:', (await c.query(`select status, revoked_at, revoke_reason from scholarships where id = any($1::uuid[])`, [rows.map(r => r.id)])).rows)
  console.log(`Respaldo en ${BACKUP}`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
