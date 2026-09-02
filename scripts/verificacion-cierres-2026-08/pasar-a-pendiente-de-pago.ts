/**
 * Alinea con la regla nueva las matrículas con costo que se hicieron ANTES del
 * cambio del 2026-09-01 y siguen sin comprobante.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/pasar-a-pendiente-de-pago.ts
 *   aplicar:  ... --aplicar
 *
 * Desde el 2026-09-01 una matrícula con costo nace 'pendiente_de_pago' y la
 * confirma el comprobante. Las de ayer y hoy quedaron 'enrolled' con el cobro
 * aparte —regla vieja— y son la MISMA situación: la persona se matriculó, no
 * pagó, y ocupa un cupo. Decisión del usuario: tratarlas igual.
 *
 * NO SE TOCAN LAS AUTOMÁTICAS DEL CIERRE. Esas nacen 'enrolled' al aprobar el
 * nivel anterior: a nadie lo dejaron a medias, el sistema lo pasó de grado. Se
 * excluyen por el GRUPO SUCESOR y además se listan una por una en el dry-run,
 * porque una exclusión que no se ve es una exclusión en la que no se puede
 * confiar.
 */
import { writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/** Los grupos SUCESORES creados por un cierre: su nombre lleva el código nuevo
 *  delante ("N4 · Nivel 3. …"). Quien está ahí llegó por aprobar, no por
 *  matricularse. */
const ES_SUCESOR = /^[A-Z0-9]+\s*·\s/

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const { rows } = await c.query<{
    enrollment_id: string; persona: string; correo: string | null
    grupo: string; monto: string; creada: string
  }>(`
    select e.id enrollment_id, m.first_name||' '||m.last_name persona, m.email correo,
           coalesce(g.name,'(sin grupo)') grupo, p.amount monto,
           to_char(e.created_at at time zone 'America/Costa_Rica','DD/MM HH24:MI') creada
    from study_enrollments e
    join members m on m.id = e.member_id
    join payments p on p.enrollment_id = e.id and p.concept = 'matricula'
    left join study_groups g on g.id = e.group_id
    where e.status = 'enrolled' and p.status = 'pending' and p.review_status is null
    order by e.created_at desc`)

  const aConvertir = rows.filter(r => !ES_SUCESOR.test(r.grupo))
  const delCierre = rows.filter(r => ES_SUCESOR.test(r.grupo))

  console.log(`SE CONVIERTEN a pendiente de pago (${aConvertir.length}):`)
  for (const r of aConvertir) console.log(`  · ${r.persona.padEnd(30)} ${r.grupo.padEnd(26)} ₡${Number(r.monto).toLocaleString('es-CR')}  ${r.creada}`)
  console.log(`\nNO se tocan — automáticas del cierre (${delCierre.length}):`)
  for (const r of delCierre) console.log(`  · ${r.persona.padEnd(30)} ${r.grupo}`)

  if (!aConvertir.length) { console.log('\nnada que convertir'); await c.end(); return }
  if (!APLICAR) { console.log(`\n(dry-run) convertiría ${aConvertir.length}. Correlo con --aplicar.`); await c.end(); return }

  writeFileSync('scripts/output/pasar-a-pendiente-2026-09-01-antes.json', JSON.stringify(rows, null, 2))
  console.log('\nrespaldo → scripts/output/pasar-a-pendiente-2026-09-01-antes.json')
  const { rowCount } = await c.query(
    `update study_enrollments set status='pendiente_de_pago', updated_at=now() where id = any($1::uuid[])`,
    [aConvertir.map(r => r.enrollment_id)],
  )
  console.log(`✓ convertidas: ${rowCount}`)
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
