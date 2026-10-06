/**
 * Mariela Saravia Valverde: completar su Nivel 3 y pasarla a Nivel 4.
 *
 *   dry-run:  npx tsx scripts/est14-legacy-2026-10/mariela-saravia.ts
 *   aplicar:  ... --aplicar
 *
 * QUÉ PASÓ. Su matrícula al Nivel 3 de Michelle Guier se registró el 5 de
 * octubre a las 10:35, dos minutos antes de que el grupo se cerrara — un
 * registro tardío de alguien que SÍ cursó el grupo (confirmado por Floriana,
 * 2026-10-05). Como entró en `pendiente_de_pago` y el cierre solo promueve a
 * quien está `enrolled` o `completed`, el cierre la saltó: los otros 9
 * quedaron evaluados y ella no.
 *
 * SE LA TRATA COMO APROBADA. Floriana dijo «ahora en n4», y eso es lo que
 * significa. El dirigente puede corregirlo después; dejarla sin evaluar sería
 * dejarla fuera del nivel que sigue.
 *
 * NO SE LE COBRA NIVEL 4. Su cobro de ₡10.000 ya cubre el par N3+N4 —el monto
 * salió del bug de EST-14, que le aplicó la regla de bloques a un grupo
 * legacy, pero el total es el mismo que habría pagado nivel por nivel— y su
 * matrícula lleva `cubre_bloque`. Un segundo cobro sería cobrarle dos veces.
 *
 * EL FOLLETO DE NIVEL 4 NO SE PIDE ACÁ. El tiquete del grupo se creó por 8 y
 * con ella serían 9, pero si ya le entregaron el par cuando se matriculó,
 * pedir otro es imprimir de más. Lo decide quien entrega.
 */
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)![1]
const c = new Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
})
const APLICAR = process.argv.includes('--aplicar')
const PERSONA = 'Mariela Saravia Valverde'

async function main() {
  await c.connect()
  const q = async (s: string, p?: unknown[]) => (await c.query(s, p as never)).rows

  // Todo se BUSCA, nada va pegado: un id a mano no se puede verificar al
  // releerlo, y si alguien ya la movió este script no debe pisarlo.
  const [m] = await q(`
    select e.id enrollment_id, e.member_id, e.status, e.cubre_bloque, e.plan_id,
           g.id group_id, g.name grupo, g.closed_at,
           g.leader_id, g.zone, g.schedule_time
      from study_enrollments e
      join members mm on mm.id = e.member_id
      join study_groups g on g.id = e.group_id
      join study_plans p on p.id = g.plan_id
     where trim(mm.first_name||' '||mm.last_name) = $1
       and p.code = 'N3' and g.closed_at is not null`, [PERSONA])
  if (!m) { console.log('No se encontró su matrícula de Nivel 3 en un grupo cerrado.'); await c.end(); return }

  // El grupo de N4 que nació de ese mismo cierre: mismo dirigente, zona y hora.
  const [n4] = await q(`
    select g.id, g.name,
           (select count(*)::int from study_enrollments e where e.group_id = g.id) matriculados
      from study_groups g join study_plans p on p.id = g.plan_id
     where p.code = 'N4'
       and g.leader_id is not distinct from $1
       and g.zone is not distinct from $2
       and g.schedule_time is not distinct from $3
       and g.status in ('en_matricula','en_curso')
     order by g.created_at desc limit 1`, [m.leader_id, m.zone, m.schedule_time])
  if (!n4) { console.log('No se encontró el grupo de Nivel 4 sucesor.'); await c.end(); return }

  const yaEnN4 = (await q(
    'select 1 from study_enrollments where group_id = $1 and member_id = $2', [n4.id, m.member_id])).length > 0

  console.log(`${PERSONA}${APLICAR ? '' : '   (DRY RUN)'}`)
  console.log(`  Nivel 3: ${m.grupo}`)
  console.log(`     ${m.status}  →  completed ('aprobado'), con la fecha del cierre`)
  console.log(`  Nivel 4: ${n4.name}  (${n4.matriculados} matriculados)`)
  console.log(`     ${yaEnN4 ? 'YA está adentro, no se toca' : 'se la matricula, SIN cobro (cubre_bloque)'}`)
  console.log(`  cubre_bloque: ${m.cubre_bloque}  ← lo que evita el segundo cobro`)
  if (!m.cubre_bloque) console.log('  ⚠ sin cubre_bloque: revisar antes de seguir, podría cobrársele N4 después.')

  if (!APLICAR) { console.log('\nPara aplicar: --aplicar'); await c.end(); return }

  await c.query('begin')
  try {
    await c.query(`
      update study_enrollments
         set status = 'completed', completed_at = $2, notes = 'aprobado'
       where id = $1 and status = 'pendiente_de_pago'`, [m.enrollment_id, m.closed_at])
    if (!yaEnN4) {
      await c.query(`
        insert into study_enrollments (member_id, plan_id, group_id, status, enrolled_at, cubre_bloque, notes)
        select $1, g.plan_id, g.id, 'enrolled', now(), true,
               'Matriculada a mano: el cierre la saltó por estar pendiente de pago'
          from study_groups g where g.id = $2`, [m.member_id, n4.id])
    }
    await c.query('commit')
    console.log('\n✓ aplicado')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })
