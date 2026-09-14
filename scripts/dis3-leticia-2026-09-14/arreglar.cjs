/**
 * El Discípulos 3 de junio 2026 quedó a nombre de la Leticia equivocada, y por
 * eso su cierre no aparecía.
 *   node scripts/dis3-leticia-2026-09-14/arreglar.cjs [--aplicar]
 *
 * ES EL MISMO GRUPO, y el formulario lo prueba solo: los 7 aprobados que
 * reportó (Hellen Galeano, Kellen Maroto, Mariana Montoya, Stephanie Torres,
 * Adrián Trejos, Graciela Gamboa y Jorge Solano) están los 7 adentro, y el
 * único reprobado que reporta —José Pablo Ramírez Bolaños, "ausencias"— es
 * exactamente la única matrícula que quedó sin nota.
 *
 * Quien mandó el formulario es Leticia Villalobos (CCB 8748) y la usuaria
 * confirmó que ella es la dirigente. El grupo estaba a nombre de Leticia
 * Obando (CCB 177), que es una ficha real y distinta —tiene su propio DIS3 de
 * noviembre 2024, que NO se toca.
 *
 * Tres pasos, en orden: el dirigente, la nota que faltaba, y recién ahí el
 * cierre — un grupo no se cierra con gente sin evaluar.
 */
const L = require('../madre-2026-09/lib.cjs')
const aplicar = process.argv.includes('--aplicar')
const GRUPO = '8bb6969a-d0d4-4ead-bf42-4d2285110d15'
const VILLALOBOS = '91417616-d05f-4393-b8de-1da82ce9d4ab'   // CCB 8748
const NOMBRE_NUEVO = 'Discípulos 3. Leticia Villalobos. Junio 2026'
const MOTIVO = 'reprobado: ausencias'

;(async () => {
  const c = L.nuevoCliente(); await c.connect()
  const q = async (s, p = []) => (await c.query(s, p)).rows

  const [antes] = await q(`select g.name, g.status, m.first_name||' '||m.last_name dirigente,
      (select count(*) from study_enrollments e where e.group_id=g.id and e.status='enrolled') sin_nota
    from study_groups g left join members m on m.id=g.leader_id where g.id=$1`, [GRUPO])
  console.log('ANTES:', antes)

  await c.query('begin')

  await c.query(`update study_groups set leader_id=$2, name=$3, updated_at=now() where id=$1`,
    [GRUPO, VILLALOBOS, NOMBRE_NUEVO])

  // La nota que faltaba. El motivo va en notes con la convención del repo:
  // "reprobado: <motivo>", que es lo que lee la pantalla de resultados.
  const { rowCount: notas } = await c.query(
    `update study_enrollments set status='reprobado', notes=$2, updated_at=now()
     where group_id=$1 and status='enrolled'`, [GRUPO, MOTIVO])

  // Cierre: ya no queda nadie sin evaluar. closed_by en NULL — lo cierra esta
  // reparación, no la dirigente.
  const { rowCount: cerrado } = await c.query(
    `update study_groups set status='finalizado', closed_at=now(), updated_at=now()
     where id=$1 and status='en_curso'
       and not exists (select 1 from study_enrollments e where e.group_id=$1 and e.status='enrolled')`, [GRUPO])

  const [despues] = await q(`select g.name, g.status, m.first_name||' '||m.last_name dirigente,
      to_char(g.closed_at,'YYYY-MM-DD') cerrado,
      (select count(*) from study_enrollments e where e.group_id=g.id and e.status='completed') aprobados,
      (select count(*) from study_enrollments e where e.group_id=g.id and e.status='reprobado') reprobados,
      (select count(*) from study_enrollments e where e.group_id=g.id and e.status='enrolled') sin_nota
    from study_groups g left join members m on m.id=g.leader_id where g.id=$1`, [GRUPO])
  console.log('DESPUÉS:', despues)
  console.log(`notas puestas: ${notas} · grupo cerrado: ${cerrado ? 'sí' : 'no'}`)

  console.log('\nel DIS3 de noviembre 2024 de Leticia Obando NO se toca:')
  console.table(await q(`select g.name, g.status, m.first_name||' '||m.last_name dirigente
    from study_groups g left join members m on m.id=g.leader_id where g.name like 'Discípulos 3. Leticia Obando%'`))

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback) — no se tocó nada.') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
