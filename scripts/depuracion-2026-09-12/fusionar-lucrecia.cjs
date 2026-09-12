/**
 * Fusionar la ÚNICA ficha duplicada real de las 5 que se sospechaban.
 *   node scripts/depuracion-2026-09-12/fusionar-lucrecia.cjs [--aplicar]
 *
 * De los 5 pares, cuatro resultaron ser PERSONAS DISTINTAS con el mismo nombre
 * (fechas de nacimiento separadas por 2 a 8 años, teléfonos y correos propios,
 * cuenta cada una). Solo Lucrecia Mora Morales es la misma persona:
 *
 *   6610  → cédula, nacimiento 1995, teléfono, correo, cuenta, 101 check-ins,
 *           11 estudios, familia. Creada en CCB en 2016.
 *   24541 → sin cédula, sin nacimiento, sin correo, sin teléfono, sin cuenta.
 *           Creada en CCB en 2026 Q2, y en NUESTRA base el 11-set por el import
 *           de asistencia, porque ese external_id no calzaba con nadie.
 *
 * Lo que lo cierra: los puestos de la ficha vacía son un SUBCONJUNTO exacto de
 * los de la completa (Coordinador Act. Sociales en Meridiano Martes, Colaborador
 * Información en Meridiano Miércoles), en las mismas sedes.
 *
 * SOFT=true a propósito: la ficha vacía queda inactiva con
 * deactivation_reason='merged' y CONSERVA su external_id. Con un borrado duro,
 * el id 24541 dejaría de mapear a nadie y el próximo import lo volvería a crear
 * — que es exactamente como nació este duplicado.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const KEEP = 'be840b4d-0ec6-4cb3-a0a6-e3e7737d8383'  // ext 6610
const DUP  = '8469506f-49b5-4427-a5a0-f4da6ab5a756'  // ext 24541

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const foto = async id => {
    const { rows: [m] } = await c.query(`select external_id, first_name||' '||last_name p, cedula,
      substr(birth_date::text,1,10) nac, email, phone, auth_user_id is not null cuenta, is_active, deactivation_reason from members where id=$1`, [id])
    if (!m) return '(la ficha ya no existe)'
    const v = await c.query(`select count(*) filter (where status='active')::int act, count(*)::int tot from volunteers where member_id=$1`, [id])
    const k = await c.query(`select count(*)::int n from event_checkins where member_id=$1`, [id])
    const e = await c.query(`select count(*)::int n from study_enrollments where member_id=$1`, [id])
    return `${m.p} (${m.external_id}) ced=${m.cedula ?? '—'} nac=${m.nac ?? '—'} ${m.email ?? '—'} cuenta=${m.cuenta} activa=${m.is_active}${m.deactivation_reason ? ` [${m.deactivation_reason}]` : ''}\n        puestos ${v.rows[0].act}/${v.rows[0].tot} · check-ins ${k.rows[0].n} · estudios ${e.rows[0].n}`
  }
  console.log('ANTES:')
  console.log('   QUEDA: ', await foto(KEEP))
  console.log('   DUP:   ', await foto(DUP))

  // Guardia: nombres idénticos. Si no calzan, no es lo que creo que es.
  const { rows: [chk] } = await c.query(
    `select (select first_name||' '||last_name from members where id=$1) a,
            (select first_name||' '||last_name from members where id=$2) b`, [KEEP, DUP])
  if (chk.a !== chk.b) { console.error(`ABORTA — los nombres no calzan: «${chk.a}» vs «${chk.b}»`); process.exit(1) }

  await c.query('begin')
  await c.query(`select merge_members($1,$2,true)`, [KEEP, DUP])
  console.log('\nDESPUÉS:')
  console.log('   QUEDA: ', await foto(KEEP))
  console.log('   DUP:   ', await foto(DUP))
  const { rows: [d] } = await c.query(`select count(*)::int n from (
    select m.first_name||' '||m.last_name p, sp.title, a.name
    from volunteers v join service_positions sp on sp.id=v.position_id join areas a on a.id=sp.area_id join members m on m.id=v.member_id
    where v.status='active' and a.name not like '[prueba]%' group by 1,2,3 having count(*)>1) t`)
  console.log(`\nduplicados (persona+puesto+comité) que quedan: ${d.n}`)
  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
