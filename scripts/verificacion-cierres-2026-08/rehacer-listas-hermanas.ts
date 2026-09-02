/**
 * Completa el filtro de las tres listas que la reconstrucción no pudo decidir.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/rehacer-listas-hermanas.ts
 *   aplicar:  ... --aplicar
 *
 * POR QUÉ VAN APARTE. rehacer-listas.ts deduce el chip de asistencia probando
 * cuál reproduce mejor la membresía guardada, y exige 50% de coincidencia y 15
 * puntos de ventaja. Estas tres no llegaron: Panorama 71% vs 61%, CDEB 59% vs
 * 45%, Hermenéutica 46%. Son las más chicas (22, 24 y 16 personas) y ahí la
 * deriva pega proporcionalmente durísimo — el 2026-08-28 se cerraron 15 grupos,
 * y uno solo le mueve el 20% a una lista de 20.
 *
 * POR QUÉ SE PUEDEN CERRAR IGUAL. No por medición sino POR ANALOGÍA, y con la
 * aprobación explícita del usuario (2026-08-28): las cinco listas con
 * "Donantes · Servidores" se crearon el mismo día en la misma sesión, las dos
 * que SÍ se pudieron medir (Intermedias 84%, Discípulos 68%) dieron "Asistencia
 * estudios", y ese mismo chip es el mejor candidato en estas tres.
 *
 * Se deja escrito que es analogía: si mañana alguna no cuadra, esta es la
 * suposición que hay que revisar primero.
 */
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

const HERMANAS = ['Invitación Panorama', 'Invitación CDEB', 'Invitación Hermenéutica']

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { getMemberLists, updateMemberList } = await import('../../src/lib/supabase/queries/member-lists')
  const { getMemberIds } = await import('../../src/lib/supabase/queries/members')

  const todas = await getMemberLists()
  let abortar = false
  const plan: Array<{ id: string; name: string; antes: number; ids: string[]; total: number; conditions: never; groups: never }> = []

  for (const nombre of HERMANAS) {
    const l = todas.find(x => x.name === nombre)
    if (!l) { console.log(`✗ ${nombre}: no existe`); abortar = true; continue }
    // Guarda: si ya tiene el filtro completo, alguien la rehizo. No se pisa.
    if (l.filters?.v === 2) { console.log(`· ${nombre}: ya tiene el filtro completo, se salta`); continue }
    // Guarda: los chips tienen que estar en la etiqueta. Si no, la analogía no
    // aplica — esta lista no es de la familia "Donantes · Servidores".
    const lab = l.segment_label ?? ''
    if (!/^Donantes · Servidores/.test(lab)) {
      console.log(`✗ ${nombre}: la etiqueta no empieza con "Donantes · Servidores" (${lab.slice(0, 40)}…)`)
      abortar = true; continue
    }
    const { ids, total } = await getMemberIds({
      conditions: l.filters.conditions, groups: l.filters.groups,
      is_donor: true, is_server: true, active_attendance: 'estudios',
    })
    console.log(`■ ${nombre}: ${l.member_count} → ${total}`)
    plan.push({ id: l.id, name: nombre, antes: l.member_count, ids, total,
      conditions: l.filters.conditions as never, groups: l.filters.groups as never })
  }

  if (abortar) { console.log('\n✗ Alguna guarda falló. No se aplica nada.'); process.exit(1) }
  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }

  console.log('\n── aplicando ──')
  for (const p of plan) {
    await updateMemberList(p.id, {
      filters: {
        v: 2, conditions: p.conditions, groups: p.groups,
        is_donor: true, is_server: true, active_attendance: 'estudios',
      },
      member_ids: p.ids, member_count: p.total,
    })
    console.log(`  ✓ ${p.name}: ${p.antes} → ${p.total}`)
  }
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
