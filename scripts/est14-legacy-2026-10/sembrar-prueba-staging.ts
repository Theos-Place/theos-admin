/**
 * Cuatro grupos en STAGING para cerrar a mano y comparar legacy vs bloques.
 *
 *   sembrar:    npx tsx scripts/est14-legacy-2026-10/sembrar-prueba-staging.ts
 *   verificar:  ... --verificar     (después de cerrarlos a mano)
 *   borrar:     ... --limpiar
 *
 * POR QUÉ N1 Y N3 Y NO N4 (Floriana, 2026-10-05): Nivel 4 es el final de la
 * cadena, así que su cierre nunca crea grupo siguiente ni pide nada. Para
 * comparar hay que cerrar los niveles que SÍ abren algo: N1 (→N2) y N3 (→N4).
 *
 * LO QUE SE ESPERA AL CERRAR CADA UNO:
 *
 *   N1 legacy   → crea N2 · tiquete de folletos de N2 · cobro a cada quien
 *   N1 bloques  → crea N2 · NADA más (el par N1+N2 se pagó al matricularse)
 *   N3 legacy   → crea N4 · tiquete de folletos de N4 · cobro a cada quien
 *   N3 bloques  → crea N4 · NADA más
 *
 * EN LOS DOS LEGACY hay un estudiante marcado «ya pagó el par». A ése NO se
 * le debe cobrar ni imprimir: es el caso real del Nivel 3 de Michelle Guier,
 * que tenía 9 estudiantes viejos y 1 que se matriculó el 5 de octubre pagando
 * el bloque entero. Si el cobro sale para 3 en vez de 2, ahí está el error.
 *
 * El dirigente es quien corre esto, para que los grupos le aparezcan en su
 * pantalla y pueda cerrarlos como lo haría un dirigente de verdad.
 *
 * SOLO STAGING: se verifica el entorno antes de escribir nada.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ENV = '.env.staging.local'
if (!existsSync(ENV)) { console.error(`✗ No existe ${ENV}.`); process.exit(1) }
const env = Object.fromEntries(
  readFileSync(ENV, 'utf8').split('\n').filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))

const URL = env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!/ellequrgrrqhtqksfrug/.test(URL)) { console.error(`✗ No es staging: ${URL}`); process.exit(1) }
const sb = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY)

const MARCA = '[prueba-est14]'
const DIRIGENTE = 'ti@theosplace.org'
const BASE = 'https://theos-admin-git-staging-theos-ti-s-projects.vercel.app'

type Caso = { nivel: 'N1' | 'N3'; modalidad: 'legacy' | 'bloques' }
const CASOS: Caso[] = [
  { nivel: 'N1', modalidad: 'legacy' },
  { nivel: 'N1', modalidad: 'bloques' },
  { nivel: 'N3', modalidad: 'legacy' },
  { nivel: 'N3', modalidad: 'bloques' },
]

async function limpiar(silencioso = false) {
  const { data: gs } = await sb.from('study_groups').select('id').like('name', `${MARCA}%`)
  const ids = ((gs ?? []) as Array<{ id: string }>).map(g => g.id)
  if (ids.length) {
    await sb.from('folleto_requests').delete().in('source_group_id', ids)
    await sb.from('payments').delete().in('study_group_id', ids)
    await sb.from('study_enrollments').delete().in('group_id', ids)
    await sb.from('study_groups').delete().in('id', ids)
  }
  const { data: ms } = await sb.from('members').select('id').like('last_name', `${MARCA}%`)
  const mids = ((ms ?? []) as Array<{ id: string }>).map(m => m.id)
  if (mids.length) {
    await sb.from('payments').delete().in('member_id', mids)
    await sb.from('study_enrollments').delete().in('member_id', mids)
    await sb.from('members').delete().in('id', mids)
  }
  if (!silencioso) console.log(`limpiado: ${ids.length} grupos, ${mids.length} personas`)
}

/**
 * Qué quedó después de que el dirigente cerró los grupos.
 *
 * Mira el SUCESOR de cada caso —lo encuentra por el plan y la zona, que es
 * lo que el sucesor hereda— y cuenta cobros y folletos. Que lo cuente el
 * script y no el ojo: la diferencia entre 2 y 3 cobros es justo el error que
 * esto viene a cazar, y es fácil no verla en una pantalla.
 */
async function verificar() {
  const SIG: Record<string, string> = { N1: 'N2', N3: 'N4' }
  let todoBien = true
  for (const caso of CASOS) {
    const zona = `${MARCA} ${caso.nivel}-${caso.modalidad}`
    const { data: orig } = await sb.from('study_groups')
      .select('id, status, closed_at').eq('zone', zona)
      .like('name', `${MARCA}%${caso.nivel} ${caso.modalidad}`).maybeSingle()
    const o = orig as { status: string; closed_at: string | null } | null

    const { data: pl } = await sb.from('study_plans').select('id').eq('code', SIG[caso.nivel]).maybeSingle()
    const { data: suc } = await sb.from('study_groups')
      .select('id, name, modalidad').eq('zone', zona)
      .eq('plan_id', (pl as { id: string }).id).maybeSingle()
    const s2 = suc as { id: string; name: string; modalidad: string } | null

    let cobros = 0, monto = 0, folletos = 0, qty = 0, nivelFolleto = '—', matriculados = 0
    if (s2) {
      const [{ data: pagos }, { data: fols }, { count }] = await Promise.all([
        sb.from('payments').select('amount').eq('study_group_id', s2.id).eq('concept', 'matricula'),
        sb.from('folleto_requests').select('target_level_code, quantity').eq('source_group_id', s2.id),
        sb.from('study_enrollments').select('id', { count: 'exact', head: true }).eq('group_id', s2.id),
      ])
      const ps = (pagos ?? []) as Array<{ amount: number }>
      const fs = (fols ?? []) as Array<{ target_level_code: string; quantity: number }>
      cobros = ps.length; monto = ps.reduce((a, p) => a + Number(p.amount), 0)
      folletos = fs.length; qty = fs[0]?.quantity ?? 0; nivelFolleto = fs[0]?.target_level_code ?? '—'
      matriculados = count ?? 0
    }

    const esperadoCobros = caso.modalidad === 'legacy' ? 2 : 0
    const esperadoFolletos = caso.modalidad === 'legacy' ? 1 : 0
    const checks: Array<[string, boolean]> = [
      ['el grupo quedó cerrado', o?.status === 'finalizado' || !!o?.closed_at],
      [`creó el grupo de ${SIG[caso.nivel]}`, !!s2],
      [`el sucesor heredó la modalidad «${caso.modalidad}»`, s2?.modalidad === caso.modalidad],
      [`cobros: ${cobros} (se esperaban ${esperadoCobros})`, cobros === esperadoCobros],
      [`folletos: ${folletos} (se esperaban ${esperadoFolletos})`, folletos === esperadoFolletos],
      ...(caso.modalidad === 'legacy'
        ? ([[`el folleto es de ${SIG[caso.nivel]} y pide 2, no 3`,
            nivelFolleto === SIG[caso.nivel] && qty === 2]] as Array<[string, boolean]>)
        : []),
    ]
    console.log(`${caso.nivel} ${caso.modalidad.toUpperCase()}`
      + (s2 ? `  → ${s2.name} (${matriculados} matriculados, ₡${monto.toLocaleString('es-CR')})` : '  → sin sucesor'))
    for (const [q, pasa] of checks) {
      console.log(`   ${pasa ? '✓' : '✗'} ${q}`)
      if (!pasa) todoBien = false
    }
    console.log('')
  }
  console.log(todoBien ? '✓ TODO BIEN' : '✗ HAY FALLAS')
  if (!todoBien) process.exit(1)
}

async function main() {
  if (process.argv.includes('--limpiar')) { await limpiar(); return }
  if (process.argv.includes('--verificar')) { await verificar(); return }
  await limpiar(true)

  const { data: dir } = await sb.from('members').select('id, first_name, last_name')
    .eq('email', DIRIGENTE).maybeSingle()
  if (!dir) {
    console.error(`✗ No existe ${DIRIGENTE} en staging.`)
    console.error(`  Creala: node scripts/staging/crear-usuario.mjs ${DIRIGENTE} "Floriana" "Fonseca" admin`)
    process.exit(1)
  }
  const dirigente = dir as { id: string; first_name: string; last_name: string }
  console.log(`dirigente: ${dirigente.first_name} ${dirigente.last_name}\n`)

  for (const caso of CASOS) {
    const { data: p } = await sb.from('study_plans').select('id, cost').eq('code', caso.nivel).maybeSingle()
    if (!p) { console.error(`✗ falta el plan ${caso.nivel}`); process.exit(1) }
    const plan = p as { id: string; cost: number | null }

    const { data: g } = await sb.from('study_groups').insert({
      plan_id: plan.id,
      name: `${MARCA} ${caso.nivel} ${caso.modalidad}`,
      modalidad: caso.modalidad,
      status: 'en_curso',
      leader_id: dirigente.id,
      // Zona y hora distintas por caso: así el buscador de sucesor no confunde
      // un grupo con otro (busca por dirigente + zona + hora).
      zone: `${MARCA} ${caso.nivel}-${caso.modalidad}`,
      schedule_time: '19:00',
      schedule_days: ['lunes'],
      starts_at: '2026-08-04',
      ends_at: '2026-09-29',
      max_students: 12,
    }).select('id').single()
    const groupId = (g as { id: string }).id

    // Tres estudiantes. En los legacy, el tercero YA pagó el par.
    const alumnos = [
      { etiqueta: 'Normal 1', par: false },
      { etiqueta: 'Normal 2', par: false },
      caso.modalidad === 'legacy'
        ? { etiqueta: 'YA pago el par', par: true }
        : { etiqueta: 'Normal 3', par: false },
    ]
    for (const a of alumnos) {
      const { data: m } = await sb.from('members').insert({
        first_name: `${caso.nivel}-${caso.modalidad}`,
        last_name: `${MARCA} ${a.etiqueta}`,
        is_active: true,
      }).select('id').single()
      await sb.from('study_enrollments').insert({
        group_id: groupId, member_id: (m as { id: string }).id, plan_id: plan.id,
        status: 'enrolled', cubre_bloque: a.par,
      })
    }

    const siguiente = caso.nivel === 'N1' ? 'Nivel 2' : 'Nivel 4'
    const conPar = caso.modalidad === 'legacy'
    console.log(`${caso.nivel} ${caso.modalidad.toUpperCase()}`)
    console.log(`   ${BASE}/estudios/grupos/${groupId}/cierre`)
    console.log(`   al cerrar debería: crear ${siguiente}`
      + (caso.modalidad === 'legacy'
        ? ` · folletos de ${siguiente} ×2 · 2 cobros de ₡${Number(plan.cost ?? 0) === 0 ? '5 000' : '5 000'}`
        : ' · NADA de folletos ni cobros'))
    if (conPar) console.log(`   (son 3 estudiantes, pero uno ya pagó el par: por eso 2 y no 3)`)
    console.log('')
  }

  console.log(`Entrá con ${DIRIGENTE} / ${env.SEED_TEST_PASSWORD ?? '(ver .env.staging.local)'}`)
  console.log(`Cerralos marcando a los 3 como APROBADOS.`)
  console.log(`Después: npx tsx scripts/est14-legacy-2026-10/sembrar-prueba-staging.ts --verificar`)
  console.log(`Para borrar todo: npx tsx scripts/est14-legacy-2026-10/sembrar-prueba-staging.ts --limpiar`)
}

main().catch(e => { console.error(e); process.exit(1) })
