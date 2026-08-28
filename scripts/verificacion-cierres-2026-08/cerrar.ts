/**
 * Aplica los cierres que el formulario "EB — Fin de Capacitación" respalda por
 * completo (aprobado por el usuario el 2026-08-28).
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/cerrar.ts
 *   aplicar:  ... cerrar.ts --aplicar
 *
 * SOLO los grupos donde CADA persona que sigue cursando aparece en el
 * formulario. Si sobra aunque sea uno, el grupo NO se toca: no hay evidencia de
 * qué pasó con esa persona, y el cierre es irreversible.
 *
 * SIN ENCUESTA AL DIRIGENTE (decisión del usuario): se llama al RPC close_group
 * directo en vez de al endpoint. El endpoint además programa la encuesta
 * (survey_send_at), y el cron la manda al día siguiente — 11 correos por
 * cierres que de verdad pasaron en julio y agosto. El RPC no toca ese campo, y
 * el cron exige survey_send_at no nulo, así que no sale nada.
 *
 * Es el MISMO RPC que usa la app al cerrar: la transacción, el claim de
 * 'finalizado' y el formato de las notas quedan idénticos a cualquier otro
 * cierre. Y es idempotente — devuelve false si el grupo ya estaba finalizado.
 */
import { writeFileSync } from 'node:fs'
import { parsearLista } from '../../src/lib/studies/ccb-form-parse'
import { leerCsv } from '../ccb-migracion-2026-08/lib'
import { cargarEnv, IndiceMiembros, todo, type Miembro } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/**
 * Nombres que el dirigente escribió distinto y que NO resuelven solos contra la
 * lista del grupo. Van a mano y confirmados por el usuario, uno por uno.
 *
 * No es una lista para ir creciendo con cada caso raro: el punto de tenerla
 * explícita es que aflojar el match por una letra —"Henrry" por "Henry"— pone
 * una nota en el expediente de alguien a partir de un parecido. Con seis
 * personas en el grupo eso casi siempre acierta; casi no alcanza.
 *
 * Confirmados por el usuario el 2026-08-28 para el grupo de Valeria Díaz.
 */
const ALIAS_POR_GRUPO: Record<string, Record<string, string>> = {
  'Religiones del mundo. Valeria Díaz. Junio 2026': {
    'Henrry': 'Henry Fonseca Prado',
    'Francesca': 'Franchesca Sciamarelli Contrera',
    'Juan Diego': 'Juan Fernández Torres',
  },
}

/**
 * Los grupos aprobados. Van por NOMBRE EXACTO y a mano: una lista fija de diez se
 * puede leer y discutir; un filtro que los recalcula puede incluir mañana un
 * grupo que nadie revisó.
 *
 * FUERA: "Religiones del mundo. Valeria Díaz. Junio 2026". El formulario lista
 * a sus diez, pero tres no resuelven contra la lista del grupo porque el
 * dirigente los escribió distinto: "Henrry" por Henry Fonseca, "Francesca" por
 * Franchesca Sciamarelli y "Juan Diego" por Juan Fernández. Son casi seguro la
 * misma gente, y por eso mismo no se resuelven acá: aflojar el match por una
 * letra para colar tres filas pone notas en el expediente de alguien a partir
 * de una corazonada. Va a confirmación del usuario.
 */
const GRUPOS = [
  'Hechos. Juan Eduardo Vargas G. Junio 2026',
  'Cómo Interpretar la Biblia. Lucía Porras. Junio 2026',
  'Sirviendo como Jesús.Jose Luis Cavero.Junio 2026',
  'Sirviendo como Jesús. Karina Cavero.Junio 2026',
  'Sirviendo como Jesús.Ariana Chaves.Junio 2026',
  'Sirviendo como Jesús.Ma. Jesús Sibaja.Junio 2026',
  'Sirviendo como Jesús.Ana Catalina Rodríguez.Junio 2026',
  'Administrando el Dinero.Stanley Benavides.Junio 2026',
  'Panorama. Alex Badilla y Marianela Hernández. Junio 2026',
  'Panorama. Eyleen Alfaro. Junio 2026',
  'Religiones del mundo. Valeria Díaz. Junio 2026',
]

const MOTIVO_REPROBADO = 'Reportado como reprobado por el dirigente en el formulario de fin de capacitación'

type Grupo = { id: string; name: string; status: string; starts_at: string | null; leader_id: string | null; co_leader_id: string | null }
type Enr = { id: string; member_id: string; group_id: string | null; status: string }

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]
  const rpc = createAdminClient() as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }

  const miembros = await todo<Miembro>(admin, 'members', 'id, external_id, first_name, last_name')
  const porId = new Map(miembros.map(m => [m.id, m]))
  const porExt = new Map(miembros.filter(m => m.external_id).map(m => [String(m.external_id).trim(), m]))
  const grupos = await todo<Grupo>(admin, 'study_groups', 'id, name, status, starts_at, leader_id, co_leader_id')
  const enrolls = await todo<Enr>(admin, 'study_enrollments', 'id, member_id, group_id, status')
  const filas = leerCsv('ccb-form-fin-capacitacion.csv')

  const plan: Array<{ grupo: Grupo; results: Array<Record<string, unknown>>; detalle: string[] }> = []
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

    // Modo laxo + match contra el roster: varios dirigentes llenaron la lista
    // con el nombre de pila, que solo es resoluble dentro del grupo.
    const decision = new Map<string, { estado: 'aprobado' | 'reprobado'; nota: number | null }>()
    for (const [campo, estado] of [['aprobaron_texto', 'aprobado'], ['reprobaron_texto', 'reprobado']] as const) {
      for (const p of parsearLista(resp[campo], true).personas) {
        const alias = ALIAS_POR_GRUPO[nombre]?.[p.nombre]
        const m = IndiceMiembros.enRoster(alias ?? p.nombre, roster)
        if (m.miembro) decision.set(m.miembro.id, { estado, nota: p.nota })
      }
    }

    // GUARDA: cada persona que sigue cursando tiene que estar en el formulario.
    const cursando = ins.filter(e => e.status === 'enrolled' || e.status === 'pendiente_de_pago')
    const sinCubrir = cursando.filter(e => !decision.has(e.member_id))
    if (sinCubrir.length) {
      console.log(`✗ ${nombre}: ${sinCubrir.length} sin cubrir (${sinCubrir.map(e => `${porId.get(e.member_id)?.first_name} ${porId.get(e.member_id)?.last_name}`).join(', ')})`)
      abortar = true
      continue
    }

    const results = cursando.map(e => {
      const d = decision.get(e.member_id)!
      return {
        member_id: e.member_id,
        status_result: d.estado,
        grade: d.nota === null ? '' : String(d.nota),
        ...(d.estado === 'reprobado' ? { fail_reason: MOTIVO_REPROBADO } : {}),
      }
    })
    const detalle = cursando.map(e => {
      const d = decision.get(e.member_id)!
      const m = porId.get(e.member_id)!
      return `      ${(m.first_name + ' ' + m.last_name).padEnd(34)} ${d.estado.padEnd(10)} nota ${d.nota ?? '—'}`
    })
    plan.push({ grupo: g, results, detalle })
    for (const e of ins) respaldo.push({ enrollment_id: e.id, group_id: g.id, group_name: g.name, member_id: e.member_id, status_previo: e.status })
    respaldo.push({ group_id: g.id, group_name: g.name, status_previo: g.status })
  }

  console.log(`\n══ PLAN ══`)
  for (const p of plan) {
    console.log(`\n  ${p.grupo.name}`)
    console.log(`    grupo → finalizado · ${p.results.length} matrícula(s) a calificar`)
    for (const d of p.detalle) console.log(d)
  }
  const aCalificar = plan.reduce((n, p) => n + p.results.length, 0)
  console.log(`\n  grupos a cerrar: ${plan.length} · matrículas a calificar: ${aCalificar}`)
  if (abortar) { console.log('\n✗ Hay grupos que no pasaron las guardas. No se aplica nada.'); process.exit(1) }
  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }

  const ruta = `scripts/output/respaldo-cierres-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(ruta, JSON.stringify(respaldo, null, 2))
  console.log(`\n  respaldo del estado previo → ${ruta}`)

  console.log('\n── aplicando ──')
  let ok = 0
  for (const p of plan) {
    const { data, error } = await rpc.rpc('close_group', { p_group_id: p.grupo.id, p_results: p.results })
    if (error) { console.log(`  ✗ ${p.grupo.name}: ${error.message}`); continue }
    if (data !== true) { console.log(`  · ${p.grupo.name}: ya estaba finalizado`); continue }
    console.log(`  ✓ ${p.grupo.name}`)
    ok++
  }
  console.log(`\n  grupos cerrados: ${ok}/${plan.length}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
