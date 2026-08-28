/**
 * La SEGUNDA aprobación de Discípulos 2 de Ana Cristina Soto y Silvia Solano.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/dis2-segundo-intento.ts
 *   aplicar:  ... dis2-segundo-intento.ts --aplicar
 *
 * Las dos llevaron Discípulos 2 dos veces y lo pasaron las dos: CCB les registra
 * el 21-jun-2022 y el 28-feb-2025. La primera es el grupo "Discipulos 2. Guiselle
 * Trejos. Junio 2022"; la segunda es el grupo que Guiselle reportó en su
 * formulario de fin y que nunca entró al sistema.
 *
 * Va sin grupo, como la de José Avendaño: es la forma normal de guardar un
 * estudio del que no tenemos el grupo (22.343 de las 36.680 matrículas de esta
 * base son así, y 122 son DIS2 aprobados de 2025-2026).
 *
 * Idempotente: si la fila del segundo intento ya existe, no se duplica.
 */
import { writeFileSync } from 'node:fs'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

const FECHA = '2025-02-28'
const NOTA = 'Aprobado al llevar Discípulos 2 por segunda vez, con Guiselle Trejos. '
  + 'El grupo de ese segundo intento no está en el sistema; consta en el formulario de fin de la dirigente.'

/** Las matrículas del grupo de 2022, del respaldo — así no hay que resolver a
 *  nadie por nombre. De acá sale el member_id de cada una. */
const PRIMERA_VUELTA = [
  { id: 'e1495102-64ff-40b9-8f1c-c393dcd49a19', quien: 'Ana Cristina Soto Villalobos' },
  { id: '8898942f-68cb-43c1-acca-37d9fae246ea', quien: 'Silvia Solano Araya' },
]

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const db = createAdminClient() as unknown as { from: (t: string) => never }
  const t = (n: string) => db.from(n) as never as {
    select: (s: string) => {
      in: (c: string, v: string[]) => Promise<{ data: Array<Record<string, string | null>> | null }>
      eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { id: string } | null }> }
    }
    insert: (v: unknown) => Promise<{ error: { message: string } | null }>
  }

  const { data: plan } = await t('study_plans').select('id').eq('code', 'DIS2').maybeSingle()
  if (!plan) { console.log('✗ no existe el plan DIS2'); process.exit(1) }

  const { data: base } = await t('study_enrollments')
    .select('id, member_id').in('id', PRIMERA_VUELTA.map(p => p.id))
  const memberPorEnrollment = new Map((base ?? []).map(f => [String(f.id), String(f.member_id)]))

  // Todo lo que ya tienen de DIS2, para no duplicar.
  const memberIds = [...memberPorEnrollment.values()]
  const { data: yaTienen } = await t('study_enrollments')
    .select('member_id, group_id, plan_id, completed_at').in('member_id', memberIds)

  const plan2: Array<{ memberId: string; quien: string }> = []
  let abortar = false
  console.log('══ PLAN ══')
  for (const p of PRIMERA_VUELTA) {
    const memberId = memberPorEnrollment.get(p.id)
    if (!memberId) { console.log(`✗ ${p.quien}: no se encontró su matrícula de 2022`); abortar = true; continue }
    const duplicada = (yaTienen ?? []).some(f =>
      f.member_id === memberId && !f.group_id && f.plan_id === plan.id
      && String(f.completed_at ?? '').slice(0, 10) === FECHA)
    if (duplicada) { console.log(`· ${p.quien}: ya la tiene, se salta`); continue }
    console.log(`  ${p.quien}: + DIS2 sin grupo, completed el ${FECHA}`)
    plan2.push({ memberId, quien: p.quien })
  }
  if (abortar) { console.log('\n✗ Alguna guarda falló. No se aplica nada.'); process.exit(1) }
  if (!plan2.length) { console.log('\nNada que hacer.'); return }
  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }

  const ruta = `scripts/output/respaldo-dis2-segundo-intento-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(ruta, JSON.stringify({ creadas_para: plan2, fecha: FECHA }, null, 2))
  console.log(`\n  qué se creó → ${ruta}`)

  console.log('\n── aplicando ──')
  for (const p of plan2) {
    const { error } = await t('study_enrollments').insert({
      member_id: p.memberId, plan_id: plan.id, group_id: null,
      status: 'completed', completed_at: `${FECHA}T12:00:00+00`, notes: NOTA,
    })
    if (error) { console.log(`  ✗ ${p.quien}: ${error.message}`); continue }
    console.log(`  ✓ ${p.quien}`)
  }
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
