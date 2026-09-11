/**
 * Cierre REAL de "Discípulos 2. Alberto Murillo. Abril 2026" (d271c810…).
 *
 * POR QUÉ A MANO Y NO POR LA PANTALLA: el RPC `close_group` no puede arreglar
 * este grupo. Dos razones, las dos verificadas:
 *   · solo toca inscripciones con `status = 'enrolled'`, y estas 8 están en
 *     'en_revision' (quedaron así de la importación del 18-jul);
 *   · el grupo YA está 'finalizado', así que el RPC devuelve false (YA_CERRADO)
 *     y no escribe nada.
 * O sea: es justo el caso DAT-5 del plan. Se escribe con la MISMA convención
 * que usa el RPC, para que clasificarResultado() lo lea igual:
 *   aprobado  → status='completed', notes='aprobado', grade
 *   reprobado → status='completed', notes='reprobado: <motivo>'
 *
 * FECHA: el dirigente reportó el 7 de setiembre de 2026 como fin. Se usa esa y
 * no now(): la nota dice cuándo aprobó la persona, no cuándo lo digitamos.
 * Se guarda al mediodía de Costa Rica para que la fecha civil sea la misma
 * leída en UTC o en CR.
 */
const { Client } = require('pg'); const fs = require('fs')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const c=new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})

const GRUPO = 'd271c810-57e9-4b77-94c3-a3b5b2426037'
const FIN   = '2026-09-07 12:00:00-06'
const ACTOR = 'c6995364-54f0-4ec6-8d5d-275fa2461f7f' // TI Theos (quien digita)
const aplicar = process.argv.includes('--aplicar')

// Nombre completo tal cual está en el padrón → resultado. El nombre se resuelve
// contra la BD y se ABORTA si alguno no calza: las dos Jimenas del grupo
// (Lopez MENA aprobó, Lopez MONTERO reprobó) hacen que un match flojo sea
// justo el error que arruinaría el expediente de las dos.
const RESULTADOS = [
  { nombre: 'Guillermo Alpízar Acosta',  resultado: 'aprobado',  nota: 100 },
  { nombre: 'Jimena Lopez Mena',         resultado: 'aprobado',  nota: 95 },
  { nombre: 'Cristina Solano Madriz',    resultado: 'aprobado',  nota: 95 },
  { nombre: 'Cesar Carrillo Mora',       resultado: 'aprobado',  nota: 90 },
  { nombre: 'Mariel Gonzalez Villareal', resultado: 'aprobado',  nota: 85 },
  { nombre: 'Amy (Eimy) Castro Murillo', resultado: 'aprobado',  nota: 85 },
  { nombre: 'Esteban Gonzalez Fallas',   resultado: 'reprobado', motivo: 'Fue trasladado a trabajar a Cartago para un proyecto. Terminando el proyecto debería poder terminar con Discípulos 3.' },
  { nombre: 'Jimena Lopez Montero',      resultado: 'reprobado', motivo: 'No terminó Discípulos 2 aduciendo motivos personales.' },
]

;(async () => {
  await c.connect()
  const { rows: inscritos } = await c.query(
    `select e.id, e.member_id, e.status, e.grade, e.notes, m.first_name||' '||m.last_name nombre
     from study_enrollments e join members m on m.id=e.member_id where e.group_id=$1`, [GRUPO])

  const porNombre = new Map(inscritos.map(r => [r.nombre, r]))
  const faltan = RESULTADOS.filter(r => !porNombre.has(r.nombre))
  const sobran = inscritos.filter(r => !RESULTADOS.some(x => x.nombre === r.nombre))
  if (faltan.length || sobran.length) {
    console.error('ABORTA — el grupo y el reporte no calzan.')
    faltan.forEach(f => console.error('  no está en el grupo:', f.nombre))
    sobran.forEach(s => console.error('  está en el grupo y no en el reporte:', s.nombre))
    process.exit(1)
  }
  console.log(`Calzan ${RESULTADOS.length}/${inscritos.length}. Ninguno queda por fuera.\n`)

  await c.query('begin')
  for (const r of RESULTADOS) {
    const e = porNombre.get(r.nombre)
    const notes = r.resultado === 'aprobado' ? 'aprobado' : `reprobado: ${r.motivo}`
    await c.query(
      `update study_enrollments set status='completed', completed_at=$2, grade=$3, notes=$4, updated_at=now()
       where id=$1`, [e.id, FIN, r.nota ?? null, notes])
  }
  // ends_at: el grupo importado decía 3-jun (fecha sintética de la carga). El
  // dirigente dice que terminó el 7-set. closed_at/closed_by van con la fecha
  // REAL de hoy: el estudio terminó el 7, el registro se hizo hoy.
  await c.query(
    `update study_groups set ends_at=$2, status='finalizado', closed_at=now(), closed_by=$3, updated_at=now()
     where id=$1`, [GRUPO, '2026-09-07', ACTOR])

  const { rows: despues } = await c.query(
    `select m.first_name||' '||m.last_name nombre, e.status, e.grade, e.notes, substr(e.completed_at::text,1,10) fin
     from study_enrollments e join members m on m.id=e.member_id where e.group_id=$1 order by e.grade desc nulls last, nombre`, [GRUPO])
  console.log('CÓMO QUEDA:')
  for (const r of despues) {
    console.log(` ${r.nombre.padEnd(30)} ${r.status.padEnd(10)} nota=${String(r.grade ?? '—').padEnd(5)} ${r.fin}  ${r.notes}`)
  }
  const { rows: g } = await c.query(`select status, substr(ends_at::text,1,10) fin, closed_at is not null cerrado from study_groups where id=$1`, [GRUPO])
  console.log('\ngrupo:', g[0])

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 SIMULACIÓN (rollback). Correr con --aplicar para escribir.') }
  await c.end()
})().catch(async e => { try { await c.query('rollback') } catch {} ; console.error(e); process.exit(1) })
