/**
 * Cierra los grupos que el archivo "cierres nivel 4.xlsx" (2026-08-31) respalda
 * POR COMPLETO: cada persona que sigue cursando aparece en el formulario.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/cerrar-nivel4-agosto.ts
 *   aplicar:  ... cerrar-nivel4-agosto.ts --aplicar
 *
 * Los grupos van por NOMBRE EXACTO y a mano, igual que en cerrar.ts: una lista
 * corta se puede leer y discutir; un filtro que la recalcula puede meter mañana
 * un grupo que nadie miró. El emparejamiento que la produjo está en
 * nuevos-nivel4.ts, que no escribe nada.
 *
 * SIN ENCUESTA AL DIRIGENTE: se llama al RPC close_group directo, igual que el
 * cierre anterior. El endpoint además programa la encuesta y el cron la manda
 * al día siguiente — correos por cierres que ya pasaron.
 */
import { writeFileSync } from 'node:fs'
import { parsearLista } from '../../src/lib/studies/ccb-form-parse'
import { leerCsv } from '../ccb-migracion-2026-08/lib'
import { cargarEnv, IndiceMiembros, todo, type Miembro } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/** grupo → respuesta que lo respalda. Verificado uno por uno. */
const GRUPOS: Array<[string, string]> = [
  ['Nivel 4. Carolina Chavarría. Junio 2026', '95342'],
  ['Nivel 4. Diana Salazar. Junio 2026', '95390'],
  ['Nivel 4. Laura Gutiérrez. Junio 2026', '95366'],
]

const MOTIVO_REPROBADO = 'Reportado como reprobado por el dirigente en el formulario de fin de Nivel 4'

type Grupo = { id: string; name: string; status: string; starts_at: string | null }
type Enr = { id: string; member_id: string; group_id: string | null; status: string }

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]
  const rpc = createAdminClient() as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }

  const miembros = await todo<Miembro>(admin, 'members', 'id, external_id, first_name, last_name')
  const porId = new Map(miembros.map(m => [m.id, m]))
  const grupos = await todo<Grupo>(admin, 'study_groups', 'id, name, status, starts_at')
  const enrolls = await todo<Enr>(admin, 'study_enrollments', 'id, member_id, group_id, status')
  const filas = leerCsv('ccb-form-fin-nivel4.csv')

  const plan: Array<{ grupo: Grupo; results: Array<Record<string, unknown>> }> = []
  const respaldo: Array<Record<string, unknown>> = []
  let abortar = false

  for (const [nombre, respId] of GRUPOS) {
    const g = grupos.find(x => x.name === nombre)
    if (!g) { console.log(`✗ ${nombre}: NO EXISTE`); abortar = true; continue }
    if (g.status === 'finalizado') { console.log(`· ${nombre}: ya finalizado, se salta`); continue }
    const resp = filas.find(r => String(r.response_id).trim() === respId)
    if (!resp) { console.log(`✗ ${nombre}: no está la respuesta ${respId}`); abortar = true; continue }

    const ins = enrolls.filter(e => e.group_id === g.id)
    const roster = ins.map(e => porId.get(e.member_id)).filter((m): m is Miembro => !!m)

    const decision = new Map<string, { estado: 'aprobado' | 'reprobado'; nota: number | null }>()
    for (const [campo, estado] of [['aprobaron_texto', 'aprobado'], ['reprobaron_texto', 'reprobado']] as const) {
      for (const p of parsearLista(resp[campo], true).personas) {
        const m = IndiceMiembros.enRoster(p.nombre, roster)
        if (m.miembro) decision.set(m.miembro.id, { estado, nota: p.nota })
      }
    }

    // GUARDA: nadie que siga cursando puede quedar sin explicación.
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
    const aprob = results.filter(r => r.status_result === 'aprobado').length
    console.log(`✓ ${nombre}`)
    console.log(`    resp ${respId} · fin ${resp.fecha_finalizacion} · ${aprob} aprobados, ${results.length - aprob} reprobados`)
    for (const e of cursando) {
      const d = decision.get(e.member_id)!
      const m = porId.get(e.member_id)
      console.log(`      ${d.estado === 'aprobado' ? '✓' : '✗'} ${m?.first_name} ${m?.last_name}${d.nota !== null ? ` (${d.nota})` : ''}`)
    }
    plan.push({ grupo: g, results })
    for (const e of ins) respaldo.push({ enrollment_id: e.id, group_id: g.id, group_name: g.name, member_id: e.member_id, status_antes: e.status })
  }

  if (abortar) { console.log('\n⛔ hay grupos con problemas — no se aplica nada'); process.exit(1) }
  if (!plan.length) { console.log('\nnada que hacer'); return }

  if (!APLICAR) { console.log(`\n(dry-run) cerraría ${plan.length} grupos. Correlo con --aplicar.`); return }

  const backup = `scripts/output/cierres-nivel4-2026-08-31-antes.json`
  writeFileSync(backup, JSON.stringify(respaldo, null, 2))
  console.log(`\nrespaldo del estado previo → ${backup}`)

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
