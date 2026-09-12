/**
 * Devolver `solicitudes_estudio` a 6 personas que lo perdieron en la depuración.
 *   node scripts/depuracion-2026-09-12/devolver-solicitudes-estudio.cjs [--aplicar]
 *
 * El rol se otorgaba solo por tener un puesto en el Comité Estudios Bíblicos, y
 * la depuración les bajó ese puesto porque no venían en el CCB de hoy. El
 * usuario confirma que sí atienden solicitudes.
 *
 * Se pone como rol MANUAL, no reactivando el puesto: revoke_position_role solo
 * desactiva los roles con origen='automatico', así que un manual sobrevive a
 * cualquier resincronización futura. Reactivar el puesto los volvería a contar
 * como servidores activos de EB, que es justo lo que la depuración corrigió.
 *
 * Misma forma que usa la pantalla de Accesos: is_active, revoked_at null,
 * origen 'manual'.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')

/** external_id → nombre esperado. El nombre es solo para verificar; el match es
 *  por external_id. Ojo: hay DOS Natalia Sancho (Benavides y Vargas) y la que
 *  perdió el rol es Benavides — buscar por nombre habría tocado a la otra. */
const GENTE = [
  ['13935', 'Brenda Mora Garita'],
  ['14397', 'Jennifer Heilbron'],
  ['18838', 'Mariela Leiton Duarte'],
  ['14302', 'Masiel Ilama Rodríguez'],
  ['1522',  'Natalia Sancho Benavides'],
  ['9318',  'Priscilla Hernandez Rodriguez'],
]

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')
  let n = 0
  for (const [ext, esperado] of GENTE) {
    const { rows: [m] } = await c.query(
      `select id, first_name||' '||last_name p from members where external_id=$1`, [ext])
    if (!m) { console.error(`ABORTA — no hay ficha con external_id ${ext}`); process.exit(1) }
    if (m.p !== esperado) { console.error(`ABORTA — ${ext} es «${m.p}», se esperaba «${esperado}»`); process.exit(1) }
    const { rows: [ya] } = await c.query(
      `select id, is_active, origen from member_roles where member_id=$1 and role='solicitudes_estudio'`, [m.id])
    if (ya) {
      await c.query(`update member_roles set is_active=true, revoked_at=null, origen='manual' where id=$1`, [ya.id])
      console.log(`   ${m.p.padEnd(32)} rol reactivado (estaba ${ya.is_active ? 'activo' : 'inactivo'}, origen ${ya.origen} → manual)`)
    } else {
      await c.query(`insert into member_roles (member_id, role, is_active, origen) values ($1,'solicitudes_estudio',true,'manual')`, [m.id])
      console.log(`   ${m.p.padEnd(32)} rol creado (manual)`)
    }
    n++
  }
  const { rows: [q] } = await c.query(
    `select count(*) filter (where is_active)::int activos, count(*) filter (where is_active and origen='manual')::int manuales
     from member_roles where role='solicitudes_estudio'`)
  console.log(`\ndevueltos: ${n}   solicitudes_estudio activos: ${q.activos} (${q.manuales} manuales)`)
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
