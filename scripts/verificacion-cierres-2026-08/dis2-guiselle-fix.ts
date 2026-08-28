/**
 * CORRECCIÓN de la corrección anterior (dis2-guiselle-2022.ts).
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/dis2-guiselle-fix.ts
 *   aplicar:  ... dis2-guiselle-fix.ts --aplicar
 *
 * QUÉ SE HIZO MAL. Se dio por hecho que el formulario de fin de Guiselle Trejos
 * era del grupo "Discipulos 2. Guiselle Trejos. Junio 2022" porque 6 de sus 7
 * nombres estaban ahí. No lo es: su fecha de finalización, 2025-02-28, es
 * exactamente la de un SEGUNDO Discípulos 2 que ella dirigió y que no está en el
 * sistema. La misma gente lo llevó dos veces, y el formulario reporta el
 * segundo intento.
 *
 * El historial de CCB que aportó el usuario lo demuestra: Ana Cristina Soto y
 * Silvia Solano tienen DOS aprobaciones de DIS2 (21-jun-2022 y 28-feb-2025), y
 * son justo las dos que el formulario da por aprobadas.
 *
 * QUÉ SE CORRIGE ACÁ:
 *
 *  1. Daniela Camacho vuelve a APROBADA. Aprobó el grupo de 2022 (CCB: DIS2 el
 *     21-jun-2022, que es su completed_at). Se la marcó reprobada aplicándole
 *     el resultado del grupo de 2025 — el error de este episodio.
 *
 *  2. Ana Cristina Soto y Silvia Solano: la fecha de su matrícula del grupo de
 *     2022 vuelve a 2022-06-21. Tenían 2025-02-28, que es la del segundo
 *     intento: la misma colisión que José Avendaño, la aprobación nueva escrita
 *     encima de la vieja por ser la única fila de DIS2 que existía.
 *
 * QUÉ NO SE TOCA: José Avendaño, Edder Fajardo y Rigoberto Jiménez quedan
 * reprobados en 2022, y eso está bien — CCB no les da ninguna aprobación de DIS2
 * en 2022 (José la tiene el 17-abr-2025, y ya está guardada aparte; los otros
 * dos no tienen ninguna).
 *
 * El grupo de 2022 queda 3 aprobados / 3 reprobados.
 */
import { writeFileSync } from 'node:fs'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/** id de matrícula → cómo tiene que quedar. Los ids salen del respaldo que
 *  dejó el script anterior, así que no hay que volver a resolver a nadie. */
const ARREGLOS: Array<{ id: string; quien: string; deStatus: string; status: string; completedAt: string; motivo: string }> = [
  {
    id: '00294645-041c-471a-8f8d-21613626704b', quien: 'Daniela Camacho Hernández',
    deStatus: 'reprobado', status: 'completed', completedAt: '2022-06-21',
    motivo: 'revierte el reprobado mal aplicado: CCB la da aprobada en DIS2 el 21-jun-2022',
  },
  {
    id: 'e1495102-64ff-40b9-8f1c-c393dcd49a19', quien: 'Ana Cristina Soto Villalobos',
    deStatus: 'completed', status: 'completed', completedAt: '2022-06-21',
    motivo: 'la fecha era la del segundo intento (28-feb-2025); esta matrícula es la del grupo de 2022',
  },
  {
    id: '8898942f-68cb-43c1-acca-37d9fae246ea', quien: 'Silvia Solano Araya',
    deStatus: 'completed', status: 'completed', completedAt: '2022-06-21',
    motivo: 'la fecha era la del segundo intento (28-feb-2025); esta matrícula es la del grupo de 2022',
  },
]

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const db = createAdminClient() as unknown as {
    from: (t: string) => never
  }
  const sel = (t: string) => db.from(t) as never as {
    select: (s: string) => { in: (c: string, v: string[]) => Promise<{ data: Array<{ id: string; status: string; completed_at: string | null; notes: string | null }> | null }> }
    update: (v: unknown) => { eq: (a: string, b: string) => { eq: (c: string, d: string) => Promise<{ error: { message: string } | null }> } }
  }

  const { data: actual } = await sel('study_enrollments')
    .select('id, status, completed_at, notes').in('id', ARREGLOS.map(a => a.id))
  const porId = new Map((actual ?? []).map(f => [f.id, f]))

  let abortar = false
  console.log('══ PLAN ══')
  for (const a of ARREGLOS) {
    const f = porId.get(a.id)
    if (!f) { console.log(`✗ ${a.quien}: matrícula no encontrada`); abortar = true; continue }
    if (f.status !== a.deStatus) {
      console.log(`✗ ${a.quien}: se esperaba '${a.deStatus}' y está en '${f.status}'`); abortar = true; continue
    }
    console.log(`\n  ${a.quien}`)
    console.log(`    ${f.status} (${String(f.completed_at ?? '—').slice(0, 10)}) → ${a.status} (${a.completedAt})`)
    console.log(`    ${a.motivo}`)
  }
  if (abortar) { console.log('\n✗ Alguna guarda falló. No se aplica nada.'); process.exit(1) }
  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }

  const ruta = `scripts/output/respaldo-dis2-guiselle-fix-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(ruta, JSON.stringify(actual, null, 2))
  console.log(`\n  respaldo → ${ruta}`)

  console.log('\n── aplicando ──')
  for (const a of ARREGLOS) {
    const { error } = await sel('study_enrollments')
      .update({ status: a.status, completed_at: `${a.completedAt}T12:00:00+00`, notes: null })
      .eq('id', a.id).eq('status', a.deStatus)
    if (error) { console.log(`  ✗ ${a.quien}: ${error.message}`); continue }
    console.log(`  ✓ ${a.quien}`)
  }
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
