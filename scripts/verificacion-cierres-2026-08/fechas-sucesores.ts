/**
 * Les pone fecha a los grupos SUCESORES que nacieron sin ninguna.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/fechas-sucesores.ts
 *   aplicar:  ... --aplicar
 *
 * El agujero ya está tapado en el código (payments.ts usa successor-dates al
 * crear el sucesor). Esto es para los que quedaron: sin fecha de fin, el
 * recordatorio de cierre no les llega nunca porque se calcula sobre ella.
 *
 * La fecha sale de la regla, no a ojo: arrancan donde terminó su predecesor.
 * El predecesor se identifica por el NOMBRE — el sucesor se llama igual con el
 * código nuevo delante ("N3 · Nivel 2. Sofía Solís. Junio 2026"), así que se
 * quita ese prefijo y se busca el grupo finalizado que queda.
 */
import { fechasDelSucesor } from '../../src/lib/studies/successor-dates'
import { cargarEnv, todo } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

type Grupo = { id: string; name: string; status: string; plan_id: string | null; starts_at: string | null; ends_at: string | null }
type Plan = { id: string; code: string; duration_weeks: number | null }

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]
  const db = createAdminClient() as unknown as {
    from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }
  }

  const grupos = await todo<Grupo>(admin, 'study_groups', 'id, name, status, plan_id, starts_at, ends_at')
  const planes = await todo<Plan>(admin, 'study_plans', 'id, code, duration_weeks')
  const planPorId = new Map(planes.map(p => [p.id, p]))
  const hoy = new Date().toISOString().slice(0, 10)

  const huerfanos = grupos.filter(g => g.status !== 'finalizado' && !g.starts_at)
  console.log(`grupos abiertos sin fecha de inicio: ${huerfanos.length}\n`)

  const cambios: Array<{ g: Grupo; starts_at: string; ends_at: string | null; pred: string }> = []
  for (const g of huerfanos) {
    const plan = g.plan_id ? planPorId.get(g.plan_id) : null
    // "N3 · Nivel 2. Sofía Solís. Junio 2026" → "Nivel 2. Sofía Solís. Junio 2026"
    const sinPrefijo = g.name.replace(/^[A-Z0-9]+\s*·\s*/, '')
    const pred = grupos.find(x => x.name === sinPrefijo && x.status === 'finalizado')
    if (!pred) { console.log(`✗ ${g.name}: no encuentro el predecesor "${sinPrefijo}"`); continue }
    const f = fechasDelSucesor({ finDelAnterior: pred.ends_at, semanas: plan?.duration_weeks, hoy })
    console.log(`✓ ${g.name}`)
    console.log(`    predecesor "${pred.name}" terminó ${String(pred.ends_at).slice(0, 10)}`)
    console.log(`    → inicia ${f.starts_at}, termina ${f.ends_at ?? '(sin duración en el plan)'}  [${plan?.code} · ${plan?.duration_weeks ?? '?'} semanas]`)
    cambios.push({ g, ...f, pred: pred.name })
  }

  if (!cambios.length) { console.log('\nnada que hacer'); return }
  if (!APLICAR) { console.log(`\n(dry-run) actualizaría ${cambios.length} grupos. Correlo con --aplicar.`); return }

  console.log('\n── aplicando ──')
  let ok = 0
  for (const c of cambios) {
    const { error } = await db.from('study_groups')
      .update({ starts_at: c.starts_at, ...(c.ends_at ? { ends_at: c.ends_at } : {}) })
      .eq('id', c.g.id)
    if (error) { console.log(`  ✗ ${c.g.name}: ${error.message}`); continue }
    console.log(`  ✓ ${c.g.name}`)
    ok++
  }
  console.log(`\n  actualizados: ${ok}/${cambios.length}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
