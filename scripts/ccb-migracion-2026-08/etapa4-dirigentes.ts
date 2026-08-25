/**
 * ETAPA 4 (coherencia) · Activar como dirigentes a quienes YA dirigen un grupo
 * activo pero no tienen el rol.
 *
 *   dry-run:  npx tsx scripts/ccb-migracion-2026-08/etapa4-dirigentes.ts
 *   aplicar:  ... etapa4-dirigentes.ts --aplicar
 *
 * Usa setDirigenteActive(), la MISMA función de la app, en vez de insertar el
 * rol a mano. Importa porque activar un dirigente no es una fila: es la ficha en
 * study_leaders, el puesto en el Comité de Dirigentes y el rol en member_roles.
 * Escribir solo el rol dejaría el estado a medias, y además saltaría las guardas
 * (no recomendado para dar estudios / en revisión) que la función sí aplica.
 *
 * EFECTO COLATERAL A SABER: al activar, la persona queda como voluntaria activa
 * del Comité de Dirigentes — o sea, pasa a contar como "servidor activo" para
 * los compromisos de matrícula. Es lo que hace la app al asignar un dirigente,
 * así que es coherente, pero conviene tenerlo presente.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { setDirigenteActive } from '../../src/lib/supabase/queries/studies'

const APLICAR = process.argv.includes('--aplicar')
const admin = createAdminClient() as unknown as { from: (t: string) => any }

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')

  const { data: grupos } = await admin.from('study_groups')
    .select('id, name, status, leader_id, co_leader_id')
    .in('status', ['en_matricula', 'en_curso'])
  const ids = new Set<string>()
  const gruposDe = new Map<string, string[]>()
  for (const g of (grupos ?? []) as any[]) {
    for (const id of [g.leader_id, g.co_leader_id]) {
      if (!id) continue
      ids.add(id)
      gruposDe.set(id, [...(gruposDe.get(id) ?? []), g.name])
    }
  }
  const { data: roles } = await admin.from('member_roles')
    .select('member_id').eq('role', 'dirigente').eq('is_active', true)
  const conRol = new Set((roles ?? []).map((r: any) => r.member_id))
  const faltantes = [...ids].filter(id => !conRol.has(id))

  const { data: personas } = await admin.from('members')
    .select('id, first_name, last_name, email').in('id', faltantes)

  console.log(`dirigentes de grupo activo: ${ids.size}`)
  console.log(`  ya tienen el rol:  ${ids.size - faltantes.length}`)
  console.log(`  SIN el rol:        ${faltantes.length}\n`)
  for (const p of (personas ?? []) as any[]) {
    console.log(`  · ${`${p.first_name} ${p.last_name}`.padEnd(32)} ${(p.email ?? '—').padEnd(34)} ${(gruposDe.get(p.id) ?? []).length} grupo(s)`)
  }

  if (!APLICAR) { console.log('\n(dry-run)'); return }
  console.log('\n── aplicando ──')
  let ok = 0
  const bloqueados: string[] = []
  for (const p of (personas ?? []) as any[]) {
    const quien = `${p.first_name} ${p.last_name}`
    try {
      await setDirigenteActive(p.id, true)
      console.log(`  ✓ ${quien}`)
      ok++
    } catch (e) {
      // Las guardas de la app: no recomendado / en revisión. No se fuerzan.
      const msg = e instanceof Error ? e.message : String(e)
      bloqueados.push(`${quien}: ${msg}`)
      console.log(`  ⛔ ${quien} — ${msg}`)
    }
  }
  console.log(`\n  activados: ${ok} · bloqueados por guarda: ${bloqueados.length}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
