/**
 * Cierra los 4 grupos que quedaban, marcando REPROBADO a quien el dirigente no
 * mencionó (decisión del usuario, 2026-08-28).
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/cerrar-con-no-mencionados.ts
 *   aplicar:  ... --aplicar
 *
 * La diferencia con cerrar.ts: ahí la guarda exigía que CADA persona que sigue
 * cursando estuviera en el formulario. Acá esa guarda se levanta a propósito,
 * porque el usuario decidió qué hacer con los que faltan.
 *
 * EL MOTIVO DICE LO QUE SABEMOS Y NADA MÁS. No hay evidencia de que estas seis
 * personas reprobaran un examen: lo único que consta es que el dirigente no las
 * puso en su lista de aprobados (se buscó asistencia para distinguirlo y los
 * cuatro grupos tienen CERO sesiones registradas). Por eso el texto que queda en
 * el expediente es exactamente eso, y no "reprobó el curso".
 *
 * NO se usa el RPC close_group para estas seis. El RPC escribe status
 * 'completed' + notes 'reprobado: …' para los reprobados, y 'completed' las
 * haría contar como aprobadas en las consultas que filtran por ese estado
 * (incluida la que bloquea volver a matricularse: YA_COMPLETADO). Van con
 * status 'reprobado', que es lo que usan las otras 152 de la base.
 */
import { writeFileSync } from 'node:fs'
import { parsearLista } from '../../src/lib/studies/ccb-form-parse'
import { leerCsv } from '../ccb-migracion-2026-08/lib'
import { cargarEnv, IndiceMiembros, todo, type Miembro } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

const GRUPOS = [
  'Evangelismo. Ariana Fonseca P. Junio 2026',
  'Evangelismo. Carlos Quesada y Juan Quesada. Junio 2026',
  'Sirviendo como Jesús.Gustavo Zamora.Junio 2026',
  'Discípulos 3. Diana Acosta. Junio 2026',
]

/** Las seis que el usuario confirmó. Explícitas: si el cruce empieza a devolver
 *  una séptima, el script se detiene en vez de reprobar a alguien que nadie
 *  revisó. */
const NO_MENCIONADOS = [
  'Mailyn Ulate Chavez', 'Carolina Viales Cubillo',
  'Hazel Carvajal Arguello', 'Lizzeth Gonzalez Blanco',
  'Kattia Alvarado Silva', 'Massiel Naranjo Hidalgo',
]

const MOTIVO = 'reprobado: el dirigente no lo mencionó como aprobado en el formulario de fin de capacitación'

type Grupo = { id: string; name: string; status: string; starts_at: string | null; leader_id: string | null; co_leader_id: string | null }
type Enr = { id: string; member_id: string; group_id: string | null; status: string }

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]
  const raw = createAdminClient() as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
    from: (t: string) => never
  }
  const upd = (t: string) => raw.from(t) as never as {
    update: (v: unknown) => { eq: (a: string, b: string) => { eq: (c: string, d: string) => Promise<{ error: { message: string } | null }> } }
  }

  const miembros = await todo<Miembro>(admin, 'members', 'id, external_id, first_name, last_name')
  const porId = new Map(miembros.map(m => [m.id, m]))
  const porExt = new Map(miembros.filter(m => m.external_id).map(m => [String(m.external_id).trim(), m]))
  const grupos = await todo<Grupo>(admin, 'study_groups', 'id, name, status, starts_at, leader_id, co_leader_id')
  const enrolls = await todo<Enr>(admin, 'study_enrollments', 'id, member_id, group_id, status')
  const filas = leerCsv('ccb-form-fin-capacitacion.csv')

  const plan: Array<{ g: Grupo; results: Array<Record<string, unknown>>; reprobar: Array<{ id: string; quien: string }>; detalle: string[] }> = []
  const respaldo: Array<Record<string, unknown>> = []
  let abortar = false

  for (const nombre of GRUPOS) {
    const g = grupos.find(x => x.name === nombre)
    if (!g) { console.log(`✗ ${nombre}: NO EXISTE`); abortar = true; continue }
    if (g.status === 'finalizado') { console.log(`· ${nombre}: ya finalizado, se salta`); continue }

    const ins = enrolls.filter(e => e.group_id === g.id)
    const roster = ins.map(e => porId.get(e.member_id)).filter((m): m is Miembro => !!m)
    const resp = filas
      .filter(r => {
        const l = porExt.get(String(r.dirigente_external_id).trim())
        return !!l && [g.leader_id, g.co_leader_id].includes(l.id)
          && !!g.starts_at && r.fecha_finalizacion > String(g.starts_at).slice(0, 10)
      })
      .sort((a, b) => b.fecha_finalizacion.localeCompare(a.fecha_finalizacion))[0]
    if (!resp) { console.log(`✗ ${nombre}: sin formulario`); abortar = true; continue }

    const decision = new Map<string, { estado: 'aprobado' | 'reprobado'; nota: number | null }>()
    for (const [campo, estado] of [['aprobaron_texto', 'aprobado'], ['reprobaron_texto', 'reprobado']] as const) {
      for (const p of parsearLista(resp[campo], true).personas) {
        const m = IndiceMiembros.enRoster(p.nombre, roster)
        if (m.miembro) decision.set(m.miembro.id, { estado, nota: p.nota })
      }
    }

    const cursando = ins.filter(e => e.status === 'enrolled' || e.status === 'pendiente_de_pago')
    const sinCubrir = cursando.filter(e => !decision.has(e.member_id))
    const nombresSinCubrir = sinCubrir.map(e => {
      const m = porId.get(e.member_id); return m ? `${m.first_name} ${m.last_name}` : '(?)'
    })
    // Guarda: los que faltan tienen que ser EXACTAMENTE los que el usuario revisó.
    const inesperados = nombresSinCubrir.filter(n => !NO_MENCIONADOS.includes(n))
    if (inesperados.length) {
      console.log(`✗ ${nombre}: aparecen sin cubrir personas que no estaban en la lista revisada: ${inesperados.join(', ')}`)
      abortar = true; continue
    }

    const results = cursando.filter(e => decision.has(e.member_id)).map(e => {
      const d = decision.get(e.member_id)!
      return { member_id: e.member_id, status_result: d.estado, grade: d.nota === null ? '' : String(d.nota) }
    })
    const detalle = [
      ...cursando.filter(e => decision.has(e.member_id)).map(e => {
        const d = decision.get(e.member_id)!, m = porId.get(e.member_id)!
        return `      ${(m.first_name + ' ' + m.last_name).padEnd(34)} ${d.estado.padEnd(10)} nota ${d.nota ?? '—'}`
      }),
      ...sinCubrir.map(e => {
        const m = porId.get(e.member_id)!
        return `      ${(m.first_name + ' ' + m.last_name).padEnd(34)} REPROBADO  (no mencionado)`
      }),
    ]
    plan.push({ g, results, reprobar: sinCubrir.map(e => ({ id: e.id, quien: `${porId.get(e.member_id)!.first_name} ${porId.get(e.member_id)!.last_name}` })), detalle })
    for (const e of ins) respaldo.push({ enrollment_id: e.id, grupo: g.name, quien: `${porId.get(e.member_id)?.first_name} ${porId.get(e.member_id)?.last_name}`, status_previo: e.status })
  }

  console.log('══ PLAN ══')
  for (const p of plan) {
    console.log(`\n  ${p.g.name}`)
    console.log(`    grupo → finalizado · ${p.results.length} del formulario · ${p.reprobar.length} no mencionado(s)`)
    for (const d of p.detalle) console.log(d)
  }
  const totalRep = plan.reduce((n, p) => n + p.reprobar.length, 0)
  console.log(`\n  grupos: ${plan.length} · del formulario: ${plan.reduce((n, p) => n + p.results.length, 0)} · reprobados por omisión: ${totalRep}`)
  if (abortar) { console.log('\n✗ Alguna guarda falló. No se aplica nada.'); process.exit(1) }
  if (totalRep !== NO_MENCIONADOS.length) {
    console.log(`\n✗ Se esperaban ${NO_MENCIONADOS.length} no mencionados y salieron ${totalRep}. No se aplica nada.`); process.exit(1)
  }
  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }

  const ruta = `scripts/output/respaldo-cierres-no-mencionados-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(ruta, JSON.stringify(respaldo, null, 2))
  console.log(`\n  respaldo → ${ruta}`)

  console.log('\n── aplicando ──')
  for (const p of plan) {
    // Los no mencionados PRIMERO: si el cierre corriera antes, el RPC los
    // dejaría 'completed' (aprobados) y habría que deshacerlo.
    let ok = true
    for (const r of p.reprobar) {
      const { error } = await upd('study_enrollments')
        .update({ status: 'reprobado', notes: MOTIVO }).eq('id', r.id).eq('status', 'enrolled')
      if (error) { console.log(`  ✗ ${r.quien}: ${error.message}`); ok = false }
      else console.log(`  ✓ ${r.quien}: reprobado (no mencionado)`)
    }
    if (!ok) { console.log(`  ✗ ${p.g.name}: NO se cierra, quedó a medias`); continue }
    const { data, error } = await raw.rpc('close_group', { p_group_id: p.g.id, p_results: p.results })
    if (error) { console.log(`  ✗ ${p.g.name}: ${error.message}`); continue }
    console.log(data === true ? `  ✓ ${p.g.name}` : `  · ${p.g.name}: ya estaba finalizado`)
  }
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
