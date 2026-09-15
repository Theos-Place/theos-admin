/**
 * Vaciar la fecha de nacimiento de los 19 adultos que figuran como menores.
 *   npx tsx --env-file=.env.local scripts/familias-2026-09-15/vaciar-fechas-falsas.cjs [--aplicar]
 *
 * POR QUÉ NULL Y NO LA FECHA BUENA: la fecha real no está en ninguna fuente que
 * tengamos. Y una fecha FALSA hace daño activo —con la regla de menores le
 * quita la cuenta a la persona y la saca de los formularios que piden correo—
 * mientras que NULL solo dice la verdad: no se sabe. El sistema ya trata "sin
 * fecha" como adulto para los bloqueos.
 *
 * CÓMO SE ELIGIERON. La señal es que la "fecha de nacimiento" cae a menos de 60
 * días de cuando se creó la ficha: es la fecha de REGISTRO metida en el campo
 * equivocado. Eso solo no alcanza —una iglesia sí registra recién nacidos— así
 * que se exige ADEMÁS una señal de que la persona es adulta. Los 19 tienen
 * correo o teléfono propio, varios corporativos (bzuniga@specialized.co.cr,
 * fherrera@jaamcr.com), y 8 llevaron estudios. Ningún bebé.
 *
 * DÓNDE QUEDA EL VALOR VIEJO: en el CSV que este script escribe, y SOLO ahí.
 * El trigger audit_members registra el UPDATE pero guarda `old_data` en null
 * —solo conserva la fila nueva—, así que para un vaciado el audit_log no sirve
 * de respaldo. Comprobado sobre este mismo cambio.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')
const MENOR = `m.birth_date is not null and m.birth_date > (current_date - interval '18 years')`
const DIAS = `abs(((m.created_at at time zone 'America/Costa_Rica')::date - m.birth_date))`

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const { rows } = await c.query(`
    select m.id, m.first_name||' '||m.last_name p, m.birth_date::text nac, ${DIAS} dias,
      (m.created_at at time zone 'America/Costa_Rica')::date::text creada,
      m.email, m.phone, m.cedula,
      (select count(*)::int from study_enrollments se where se.member_id=m.id) estudios
    from members m where m.is_active and ${MENOR}
      and not exists (select 1 from family_members f where f.member_id=m.id)
      and ${DIAS} <= 60
      -- Sin una señal de adulto no se toca: podría ser un recién nacido real.
      and (m.email is not null or m.phone is not null or m.cedula is not null
           or exists (select 1 from study_enrollments se where se.member_id=m.id))
    order by m.birth_date`)

  console.log(`fichas a vaciar: ${rows.length}\n`)
  rows.forEach(r => console.log(`   ${r.p.padEnd(30)} ${r.nac} → (vacío) · ficha creada ${r.creada}, ${r.dias}d después · ${r.email ?? r.phone}`))

  fs.writeFileSync('data-import/fechas-vaciadas-2026-09-15.csv',
    [['Persona', 'Fecha que tenía', 'Ficha creada', 'Días de diferencia', 'Correo', 'Teléfono', 'Cédula', 'Estudios'],
     ...rows.map(r => [r.p, r.nac, r.creada, r.dias, r.email, r.phone, r.cedula, r.estudios])]
      .map(x => x.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'))

  const { rowCount } = await c.query(
    `update members set birth_date = null, updated_at = now() where id = any($1)`, [rows.map(r => r.id)])
  console.log(`\nvaciadas: ${rowCount}`)

  // Guardias: ninguno debe seguir contando como menor, y no se tocó a nadie más.
  const { rows: [g] } = await c.query(`
    select count(*) filter (where m.birth_date is not null)::int con_fecha,
           count(*)::int total from members m where m.id = any($1)`, [rows.map(r => r.id)])
  const { rows: [t] } = await c.query(`select count(*)::int n from members m where m.is_active and ${MENOR}`)
  console.log(`   siguen con fecha: ${g.con_fecha} de ${g.total} ${g.con_fecha === 0 ? '✓' : '⚠️'}`)
  console.log(`   menores activos en el padrón: ${t.n}  (antes 1107)`)
  if (g.con_fecha > 0) { await c.query('rollback'); console.log('\n❌ Rollback.'); await c.end(); return }
  console.log('CSV con las fechas viejas: data-import/fechas-vaciadas-2026-09-15.csv')

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
