/**
 * Segunda tanda de "cierres nivel 4.xlsx": los grupos donde el dirigente
 * escribió algún nombre distinto a como está en la ficha, CONFIRMADOS uno por
 * uno por el usuario el 2026-08-31.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/cerrar-nivel4-confirmados.ts
 *   aplicar:  ... --aplicar
 *
 * Por qué van a mano y no con un match difuso: "Sheyla" por Sheila y
 * "Montserrat" por Monserrath son casi seguro la misma persona, y por eso mismo
 * el emparejador no los resuelve solo. Aflojar por una letra pone una nota en
 * el expediente de alguien a partir de un parecido, y el cierre no se deshace.
 * Acá cada equivalencia la miró una persona.
 */
import { writeFileSync } from 'node:fs'
import { parsearLista } from '../../src/lib/studies/ccb-form-parse'
import { leerCsv } from '../ccb-migracion-2026-08/lib'
import { cargarEnv, IndiceMiembros, todo, type Miembro } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/** Lo que escribió el dirigente → nombre de la ficha. Confirmado por el usuario. */
const ALIAS: Record<string, Record<string, string>> = {
  'Nivel 4. Vanessa Mena. Junio 2026': { 'Dyna Romero': 'Dina Romero Vargas' },
  'Nivel 4. Jose Pablo Echeverría. Junio 2026': {
    'Daniela Vargas': 'Daniella Vargas Carrera',
    'Maibeth Madrigal Valverde': 'Maybeth Madrigal',
  },
  'Nivel 4. Catalina Esquivel. Junio 2026': { 'Steban Padilla Benavides': 'Esteban Padilla Benavides' },
  // Confirmado por el usuario: "Ricardo Umaña y Eliecer/Yeye Vega es correcto".
  // Acá no era una letra —los apellidos no coinciden— por eso se preguntó.
  'Nivel 4. Israel González. Junio 2026 (Virtual)': {
    'Ricardo Ulloa': 'Ricardo Umaña Bermúdez',
    'Eliecer Vega': 'Yeye Vega',
  },
  'Nivel 4. Jose Carlos Guerrero y Catalina Hdez. Junio 2026': {
    'Willken Hibbert Chavarría': 'Wilken Hibbert Chavarría',
    'Roselyn del Carmen': 'Roselyn Garita Villalta',
  },
  // Este grupo esperaba a que se fusionaran las dos fichas de Vilma Tripovic
  // (misma persona, dos external_id). Con una sola ficha su nombre deja de
  // salir ambiguo. "Mari" por Mariela lo resuelve solo el emparejador.
  'Nivel 4. Sergio Colombari/Andrea Zamora. Junio 2026': {
    'Sheyla Montero': 'Sheila Montero Rubi',
    'Montserrat Zamora': 'Monserrath Zamora Guzman',
  },
}

/**
 * Gente que el dirigente NO mencionó, ni como aprobada ni como reprobada, y que
 * el usuario decidió marcar reprobada el 2026-08-31. No es una inferencia del
 * script: sin esta lista el grupo no cerraría.
 */
const REPROBAR_NO_MENCIONADOS: Record<string, string[]> = {
  'Nivel 4. Catalina Esquivel. Junio 2026': ['Viviana López Blanco'],
  'Nivel 4. Cristina Pacheco/Donald Loaiza. Junio 2026': ['Daniela Ulloa'],
}

const GRUPOS: Array<[string, string]> = [
  ['Nivel 4. Cristina Pacheco/Donald Loaiza. Junio 2026', '95334'],
  ['Nivel 4. Vanessa Mena. Junio 2026', '95336'],
  ['Nivel 4. Jose Pablo Echeverría. Junio 2026', '95337'],
  ['Nivel 4. Catalina Esquivel. Junio 2026', '95338'],
  ['Nivel 4. Israel González. Junio 2026 (Virtual)', '95341'],
  ['Nivel 4. Jose Carlos Guerrero y Catalina Hdez. Junio 2026', '95376'],
  ['Nivel 4. Sergio Colombari/Andrea Zamora. Junio 2026', '95368'],
]

const MOTIVO_FORM = 'Reportado como reprobado por el dirigente en el formulario de fin de Nivel 4'
const MOTIVO_NO_MENCIONADO = 'El dirigente no lo incluyó en el cierre; marcado reprobado por la coordinación'

type Grupo = { id: string; name: string; status: string }
type Enr = { id: string; member_id: string; group_id: string | null; status: string }

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]
  const rpc = createAdminClient() as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }

  const miembros = await todo<Miembro>(admin, 'members', 'id, external_id, first_name, last_name')
  const porId = new Map(miembros.map(m => [m.id, m]))
  const grupos = await todo<Grupo>(admin, 'study_groups', 'id, name, status')
  const enrolls = await todo<Enr>(admin, 'study_enrollments', 'id, member_id, group_id, status')
  const filas = leerCsv('ccb-form-fin-nivel4.csv')

  const plan: Array<{ grupo: Grupo; results: Array<Record<string, unknown>> }> = []
  const respaldo: Array<Record<string, unknown>> = []
  let abortar = false

  for (const [nombre, respId] of GRUPOS) {
    const g = grupos.find(x => x.name === nombre)
    if (!g) { console.log(`✗ ${nombre}: NO EXISTE`); abortar = true; continue }
    if (g.status === 'finalizado') { console.log(`· ${nombre}: ya finalizado`); continue }
    const resp = filas.find(r => String(r.response_id).trim() === respId)
    if (!resp) { console.log(`✗ ${nombre}: falta la respuesta ${respId}`); abortar = true; continue }

    const ins = enrolls.filter(e => e.group_id === g.id)
    const roster = ins.map(e => porId.get(e.member_id)).filter((m): m is Miembro => !!m)

    const decision = new Map<string, { estado: 'aprobado' | 'reprobado'; nota: number | null; motivo: string }>()
    for (const [campo, estado] of [['aprobaron_texto', 'aprobado'], ['reprobaron_texto', 'reprobado']] as const) {
      for (const p of parsearLista(resp[campo], true).personas) {
        const alias = ALIAS[nombre]?.[p.nombre]
        const m = IndiceMiembros.enRoster(alias ?? p.nombre, roster)
        if (m.miembro) decision.set(m.miembro.id, { estado, nota: p.nota, motivo: MOTIVO_FORM })
        else if (alias) { console.log(`✗ ${nombre}: el alias "${p.nombre}" → "${alias}" no resuelve`); abortar = true }
      }
    }
    // Los que el usuario mandó reprobar por no venir en el formulario.
    for (const quien of REPROBAR_NO_MENCIONADOS[nombre] ?? []) {
      const m = IndiceMiembros.enRoster(quien, roster)
      if (!m.miembro) { console.log(`✗ ${nombre}: no encuentro a "${quien}" en el grupo`); abortar = true; continue }
      decision.set(m.miembro.id, { estado: 'reprobado', nota: null, motivo: MOTIVO_NO_MENCIONADO })
    }

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
        ...(d.estado === 'reprobado' ? { fail_reason: d.motivo } : {}),
      }
    })
    const aprob = results.filter(r => r.status_result === 'aprobado').length
    console.log(`✓ ${nombre}  (resp ${respId}) — ${aprob} aprobados, ${results.length - aprob} reprobados`)
    for (const e of cursando) {
      const d = decision.get(e.member_id)!
      const m = porId.get(e.member_id)
      console.log(`      ${d.estado === 'aprobado' ? '✓' : '✗'} ${m?.first_name} ${m?.last_name}${d.estado === 'reprobado' ? `  ← ${d.motivo === MOTIVO_NO_MENCIONADO ? 'no mencionado' : 'reportado por el dirigente'}` : ''}`)
    }
    plan.push({ grupo: g, results })
    for (const e of ins) respaldo.push({ enrollment_id: e.id, group_id: g.id, group_name: g.name, member_id: e.member_id, status_antes: e.status })
  }

  if (abortar) { console.log('\n⛔ hay problemas — no se aplica nada'); process.exit(1) }
  if (!plan.length) { console.log('\nnada que hacer'); return }
  if (!APLICAR) { console.log(`\n(dry-run) cerraría ${plan.length} grupos. Correlo con --aplicar.`); return }

  const backup = 'scripts/output/cierres-nivel4-confirmados-2026-08-31-antes.json'
  writeFileSync(backup, JSON.stringify(respaldo, null, 2))
  console.log(`\nrespaldo → ${backup}\n── aplicando ──`)
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
