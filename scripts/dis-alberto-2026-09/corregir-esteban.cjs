/**
 * Corrección (usuario, 2026-09-11): Esteban Gonzalez Fallas SÍ terminó
 * Discípulos 2 — lo que le falta es el 3.
 *
 * El reporte del dirigente lo tenía bajo "personas que reprobaron", pero su
 * propio texto ya lo decía: "fue trasladado a Cartago… terminando el proyecto
 * debería poder terminar con Discípulos 3". O sea que lo que no hizo fue el 3,
 * no el 2. Queda aprobado de DIS2 SIN nota: el dirigente no reportó ninguna
 * para él, y ponerle una sería inventarla.
 *
 * El motivo del traslado no se tira: pasa a la nota de su DIS2, que es donde se
 * va a leer cuando alguien se pregunte por qué no siguió. Se antepone
 * "aprobado" porque es como el resto del sistema lee el resultado
 * (clasificarResultado / adapter).
 *
 * NO entra a Discípulos 3: es justamente lo que le falta.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})

const DIS2_GRUPO = 'd271c810-57e9-4b77-94c3-a3b5b2426037'
const NOTA = 'aprobado. Pendiente Discípulos 3: fue trasladado a trabajar a Cartago para un proyecto. Terminando el proyecto debería poder terminar con Discípulos 3.'
const aplicar = process.argv.includes('--aplicar')

;(async () => {
  await c.connect()
  const { rows } = await c.query(
    `select e.id, e.status, e.notes, e.grade, m.first_name||' '||m.last_name nombre
     from study_enrollments e join members m on m.id=e.member_id
     where e.group_id=$1 and m.first_name='Esteban' and m.last_name='Gonzalez Fallas'`, [DIS2_GRUPO])
  if (rows.length !== 1) { console.error('ABORTA — esperaba 1 fila de Esteban, hay', rows.length); process.exit(1) }
  console.log('antes:', rows[0])

  await c.query('begin')
  await c.query(`update study_enrollments set notes=$2, updated_at=now() where id=$1`, [rows[0].id, NOTA])

  const { rows: d } = await c.query(
    `select e.status, e.grade, e.notes, substr(e.completed_at::text,1,10) fin
     from study_enrollments e where e.id=$1`, [rows[0].id])
  console.log('\ndespués:', d[0])
  const { rows: cuenta } = await c.query(
    `select count(*) filter (where notes like 'reprobado:%')::int reprobados,
            count(*) filter (where status='completed' and notes not like 'reprobado:%')::int aprobados
     from study_enrollments where group_id=$1`, [DIS2_GRUPO])
  console.log('DIS2 queda en:', cuenta[0])

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 SIMULACIÓN (rollback).') }
  await c.end()
})().catch(async e => { try { await c.query('rollback') } catch {} ; console.error(e); process.exit(1) })
