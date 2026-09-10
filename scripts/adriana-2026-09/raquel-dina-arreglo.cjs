/**
 * Mismo enredo que Adriana, en Raquel y en Dina (2026-09-10).
 *
 * RAQUEL. Transfirió ₡5.000 UNA vez (una sola referencia SINPE) pero quedaron
 * DOS pagos aprobados con esa misma referencia, más un pendiente fantasma. El
 * sistema decía ₡10.000. Se conserva el registro ORIGINAL —el del 1 de
 * setiembre, que es cuando de verdad pagó— y se le apunta a la matrícula que
 * hoy está viva.
 *
 * DINA. Su pago aprobado quedó HUÉRFANO: sin matrícula y sin grupo. Y encima
 * le crearon un pendiente por el mismo monto, así que su matrícula figura como
 * 'pendiente_de_pago' cuando ya pagó. Se enlaza el pago real y se le confirma
 * la matrícula.
 *
 *   node scripts/adriana-2026-09/raquel-dina-arreglo.cjs            (ensayo)
 *   node scripts/adriana-2026-09/raquel-dina-arreglo.cjs --aplicar
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const aplicar = process.argv.includes('--aplicar')

const R = {
  member: '932170b3-ebd2-4bf4-aa3c-9e3693c217ad',
  queda:  '1d0ff542-992d-47da-b5d9-7a64a8117db6', // 1 set, la fecha real del SINPE
  borrar: ['620d2ec1-306d-49df-9c5c-0c0a8febefb1', 'ee3b2127-1dc6-482c-a4fc-68fd1060e9d9'],
}
const D = {
  member: '1e824723-6698-4845-bf72-78fe3e1fd3a9',
  pagoReal: '8954144b-b0d6-43c5-8c9d-20fc9b7cb290',
  borrar: ['9056dbe9-d1e5-4efc-9465-1caf67417923'],
}
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})
const foto = async (id) => (await c.query(`
  select to_char(p.created_at at time zone 'America/Costa_Rica','DD/MM HH24:MI') creado, p.status, p.amount,
         g.name grupo, e.status matricula
  from payments p left join study_groups g on g.id=p.study_group_id
  left join study_enrollments e on e.id=p.enrollment_id
  where p.member_id=$1 order by p.created_at`, [id])).rows
const total = async (id) => (await c.query(
  `select coalesce(sum(amount),0) t from payments where member_id=$1 and status='paid'`, [id])).rows[0].t

;(async()=>{
  await c.connect()
  // La matrícula viva de cada una.
  const viva = async (id) => (await c.query(`
    select e.id, e.group_id, g.name from study_enrollments e join study_groups g on g.id=e.group_id
    where e.member_id=$1 and e.status in ('enrolled','pendiente_de_pago') order by e.created_at desc limit 1`, [id])).rows[0]
  const vr = await viva(R.member), vd = await viva(D.member)
  console.log('Raquel · matrícula viva:', vr?.name, vr?.id)
  console.log('Dina   · matrícula viva:', vd?.name, vd?.id)
  console.log('\nANTES · Raquel'); console.table(await foto(R.member)); console.log('  total pagado:', await total(R.member))
  console.log('ANTES · Dina');   console.table(await foto(D.member));   console.log('  total pagado:', await total(D.member))

  await c.query('BEGIN')
  try {
    // Raquel: el pago original pasa a su matrícula viva; se van el duplicado y el fantasma.
    await c.query(`update payments set enrollment_id=$1, study_group_id=$2,
      description=$3, updated_at=now() where id=$4`,
      [vr.id, vr.group_id, `Matrícula · ${vr.name}`, R.queda])
    await c.query(`delete from payments where id = any($1)`, [R.borrar])
    // Dina: se enlaza su pago real y se va el pendiente; la matrícula queda confirmada.
    await c.query(`update payments set enrollment_id=$1, study_group_id=$2,
      description=$3, updated_at=now() where id=$4`,
      [vd.id, vd.group_id, `Matrícula · ${vd.name}`, D.pagoReal])
    await c.query(`delete from payments where id = any($1)`, [D.borrar])
    await c.query(`update study_enrollments set status='enrolled', updated_at=now()
      where id=$1 and status='pendiente_de_pago'`, [vd.id])

    console.log('\nDESPUÉS · Raquel'); console.table(await foto(R.member)); console.log('  total pagado:', await total(R.member))
    console.log('DESPUÉS · Dina');   console.table(await foto(D.member));   console.log('  total pagado:', await total(D.member))
    if (aplicar) { await c.query('COMMIT'); console.log('\n✓ aplicado') }
    else { await c.query('ROLLBACK'); console.log('\nEnsayo: nada se guardó. Corré con --aplicar.') }
  } catch (e) { await c.query('ROLLBACK'); throw e }
  finally { await c.end() }
})().catch(e=>{console.error('✗', e.message);process.exit(1)})
