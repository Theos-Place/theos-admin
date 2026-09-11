/**
 * Discípulos 3 de Alberto Murillo: crear el grupo, meter a los 6 que aprobaron
 * Discípulos 2, cerrarlo y dejar las dos recomendaciones de dirigente.
 *
 * POR QUÉ A MANO. El cierre normal de DIS2 habría creado este grupo solo
 * (autoEnrollApprovedToNextLevel), pero ese camino estaba cerrado: el RPC
 * close_group no podía tocar este grupo (ver cerrar-dis2.cjs). Además el
 * automático habría creado el grupo 'en_curso' arrancando el 19-set y con un
 * tiquete de FOLLETOS para imprenta — folletos de un curso que ya se dio.
 *
 * FECHAS. Contradicción real en lo que reportó el dirigente: escribió el 7 de
 * setiembre como fin de Discípulos 2 y a la vez "terminamos discípulos 3 a
 * finales de setiembre". Los dos no pueden ser: no se hace un curso de 10
 * semanas en 4 días. Lo más coherente con los datos es que DIS2 terminó en su
 * plazo (1-abr → 3-jun, que es exactamente las 9 semanas del plan) y que el 7
 * de setiembre es cuando mandó el reporte. Entonces:
 *   · el grupo DIS2 vuelve a su plazo (3-jun) — la fecha del grupo es su
 *     período, no cuándo llegó el papel;
 *   · las personas conservan el 7-set como fecha de aprobación, que es la
 *     única fecha que el dirigente escribió;
 *   · DIS3 corre del 3-jun al 11-set (hoy), que es lo que dijo el usuario.
 *
 * NOMBRE. "Discípulos 3. Alberto Murillo. Junio 2026" — el mes es el de INICIO,
 * igual que los otros 5 grupos de DIS3 que ya existen.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})

const DIS2_GRUPO = 'd271c810-57e9-4b77-94c3-a3b5b2426037'
const DIS3_PLAN  = '669ed500-d259-43df-a8d7-8adc20c07df8'
const ALBERTO    = 'ccdfc699-f970-4695-8c9d-0d565676226d'
const ACTOR      = 'c6995364-54f0-4ec6-8d5d-275fa2461f7f' // TI Theos
const INICIO     = '2026-06-03'
const FIN        = '2026-09-11'
const FIN_TS     = '2026-09-11 12:00:00-06'
const aplicar = process.argv.includes('--aplicar')

// Las mismas notas de Discípulos 2 (decisión del usuario 2026-09-11: Alberto no
// reportó notas para el 3).
const APROBADOS = [
  { nombre: 'Guillermo Alpízar Acosta',  nota: 100, recomendacion: 'Podría dar Panorama o Apologética con la preparación correcta.' },
  { nombre: 'Jimena Lopez Mena',         nota: 95,  recomendacion: 'Podría dar niveles básicos.' },
  { nombre: 'Cristina Solano Madriz',    nota: 95 },
  { nombre: 'Cesar Carrillo Mora',       nota: 90 },
  { nombre: 'Mariel Gonzalez Villareal', nota: 85 },
  { nombre: 'Amy (Eimy) Castro Murillo', nota: 85 },
]

;(async () => {
  await c.connect()

  // Solo los que APROBARON DIS2 pasan. Esteban y Jimena Montero reprobaron, así
  // que no avanzan — se resuelve contra la BD y no contra la lista de arriba.
  const { rows: aprobaronDis2 } = await c.query(
    `select e.member_id, m.first_name||' '||m.last_name nombre
     from study_enrollments e join members m on m.id=e.member_id
     where e.group_id=$1 and e.status='completed' and e.notes='aprobado'`, [DIS2_GRUPO])
  const idPorNombre = new Map(aprobaronDis2.map(r => [r.nombre, r.member_id]))
  const faltan = APROBADOS.filter(a => !idPorNombre.has(a.nombre))
  if (faltan.length || aprobaronDis2.length !== APROBADOS.length) {
    console.error('ABORTA — los aprobados de DIS2 no calzan con la lista.')
    faltan.forEach(f => console.error('  no aprobó DIS2:', f.nombre))
    aprobaronDis2.filter(r => !APROBADOS.some(a => a.nombre === r.nombre))
      .forEach(r => console.error('  aprobó DIS2 y no está en la lista:', r.nombre))
    process.exit(1)
  }
  console.log(`Los ${APROBADOS.length} que aprobaron Discípulos 2 pasan al 3. Ninguno queda por fuera.\n`)

  // Guardia: que no exista ya un DIS3 de Alberto (correr esto dos veces crearía
  // un grupo duplicado — el índice único del sucesor no cubre 'finalizado').
  const { rows: yaHay } = await c.query(
    `select id, name from study_groups where plan_id=$1 and leader_id=$2`, [DIS3_PLAN, ALBERTO])
  if (yaHay.length) { console.error('ABORTA — Alberto ya tiene un grupo de Discípulos 3:', yaHay); process.exit(1) }

  await c.query('begin')

  await c.query(`update study_groups set ends_at=$2, updated_at=now() where id=$1`, [DIS2_GRUPO, '2026-06-03'])

  const { rows: [g] } = await c.query(
    `insert into study_groups (plan_id, name, leader_id, starts_at, ends_at, status, is_virtual, survey_enabled, current_week, closed_at, closed_by)
     values ($1,$2,$3,$4,$5,'finalizado',false,true,0,now(),$6) returning id, name`,
    [DIS3_PLAN, 'Discípulos 3. Alberto Murillo. Junio 2026', ALBERTO, INICIO, FIN, ACTOR])
  console.log('grupo creado:', g.name, g.id)

  for (const a of APROBADOS) {
    const memberId = idPorNombre.get(a.nombre)
    await c.query(
      `insert into study_enrollments (group_id, member_id, plan_id, status, enrolled_at, completed_at, grade, notes, recorded_by)
       values ($1,$2,$3,'completed',$4,$5,$6,'aprobado',$7)`,
      [g.id, memberId, DIS3_PLAN, INICIO, FIN_TS, a.nota, ACTOR])
    if (a.recomendacion) {
      await c.query(
        `insert into member_recommendations (member_id, recommended_for, justification, recommended_by, study_group_id)
         values ($1,'dirigente',$2,$3,$4)`, [memberId, a.recomendacion, ACTOR, g.id])
    }
  }

  const { rows: fin } = await c.query(
    `select m.first_name||' '||m.last_name nombre, e.status, e.grade, substr(e.completed_at::text,1,10) fin
     from study_enrollments e join members m on m.id=e.member_id where e.group_id=$1 order by e.grade desc, nombre`, [g.id])
  console.log('\nDISCÍPULOS 3:')
  fin.forEach(r => console.log(` ${r.nombre.padEnd(30)} ${r.status.padEnd(10)} nota=${r.grade}  ${r.fin}`))
  const { rows: recs } = await c.query(
    `select m.first_name||' '||m.last_name nombre, r.recommended_for, r.justification
     from member_recommendations r join members m on m.id=r.member_id where r.study_group_id=$1`, [g.id])
  console.log('\nRECOMENDACIONES:')
  recs.forEach(r => console.log(` ${r.nombre} → ${r.recommended_for}: ${r.justification}`))
  const { rows: d2 } = await c.query(`select substr(ends_at::text,1,10) fin from study_groups where id=$1`, [DIS2_GRUPO])
  console.log('\nDIS2 vuelve a su plazo, fin =', d2[0].fin)

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 SIMULACIÓN (rollback). Correr con --aplicar para escribir.') }
  await c.end()
})().catch(async e => { try { await c.query('rollback') } catch {} ; console.error(e); process.exit(1) })
