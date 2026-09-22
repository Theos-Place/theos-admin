/**
 * SRV · El rol `lider_comite` se le da a TODA persona con la estrellita.
 *
 *   node scripts/srv/rol-de-lider.cjs            # dry-run
 *   APLICAR=1 node scripts/srv/rol-de-lider.cjs
 *
 * POR QUÉ HIZO FALTA (2026-09-22). Encargar un comité se deriva de los PUESTOS
 * desde SRV-5, pero el rol es un dato aparte que se escribe a mano — y se
 * desincronizó: 17 personas con la estrellita no lo tenían. George Vivas,
 * encargado de DOS comités, veía "Acceso restringido" en Mi comité.
 *
 * El código ya no depende de esto para dar acceso —la API mira los puestos—,
 * pero el rol sigue existiendo y el sidebar lo usa para dibujar el enlace, así
 * que tiene que estar al día.
 *
 * NO LE QUITA el rol a nadie. Hay tres que lo tienen sin encargar comité y dos
 * son cuentas genéricas; sacárselo es una decisión aparte, no un efecto
 * colateral de esto.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'

const CON_ESTRELLA = `
  select distinct v.member_id
  from volunteers v
  join service_positions p on p.id = v.position_id and coalesce(p.is_active,true)
  join areas a on a.id = p.area_id and a.area_type = 'committee' and coalesce(a.is_active,true)
  where v.status = 'active' and p.title ilike 'encargado%'`

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const { rows: faltan } = await c.query(`
      select x.member_id, m.first_name||' '||m.last_name nombre, m.email
      from (${CON_ESTRELLA}) x
      join members m on m.id = x.member_id
      where not exists (
        select 1 from member_roles r
        where r.member_id = x.member_id and r.role = 'lider_comite' and r.is_active)
      order by 2`)
    console.log(`personas con estrellita sin el rol: ${faltan.length}`)
    console.table(faltan.map(f => ({ nombre: f.nombre, correo: f.email })))

    for (const f of faltan) {
      // Puede existir la fila desactivada de una vez anterior: se reactiva en
      // vez de insertar otra.
      const upd = await c.query(
        `update member_roles set is_active = true
         where member_id = $1 and role = 'lider_comite'`, [f.member_id])
      if (upd.rowCount === 0) {
        await c.query(
          `insert into member_roles (member_id, role, is_active) values ($1, 'lider_comite', true)`,
          [f.member_id])
      }
    }

    const { rows: [{ n }] } = await c.query(`
      select count(*)::int n from (${CON_ESTRELLA}) x
      where not exists (
        select 1 from member_roles r
        where r.member_id = x.member_id and r.role = 'lider_comite' and r.is_active)`)
    console.log(`\nquedan sin el rol: ${n} (debe ser 0)`)
    if (n !== 0) throw new Error('alguien quedó sin el rol')

    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
