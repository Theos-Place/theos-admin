/**
 * Fusiona las dos fichas de Vilma Tripovic Herrera (autorizado por el usuario,
 * 2026-08-31). Misma persona, mismo correo y mismo teléfono, dos external_id de
 * la importación:
 *
 *   CONSERVA  0531a06e… · external_id 23051 · ACTIVA   · 4 matrículas · sin cuenta
 *   ABSORBE   2010bfb3… · external_id 24704 · inactiva · 1 matrícula  · CON cuenta
 *
 * Por qué se conserva la activa y no la que tiene cuenta: merge_members mueve
 * matrículas, pagos, roles y familia, pero NO toca `auth_user_id`. Borrar la
 * ficha con cuenta le dejaría a Vilma la ficha buena sin acceso al sistema. Así
 * que el vínculo se pasa A MANO antes de fusionar, y recién ahí se borra la
 * duplicada.
 *
 * La duplicada se BORRA (soft=false) en vez de desactivarse: una ficha
 * desactivada es exactamente lo que causó el enredo — no sale en el padrón,
 * pero su matrícula sigue viva en el grupo y el cierre no cuadra.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/merge-vilma.ts
 *   aplicar:  ... --aplicar
 */
import { writeFileSync } from 'node:fs'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

const KEEP = '0531a06e-0b41-4756-b68c-bb2252b0ff0e'
const DUP  = '2010bfb3-e379-4712-8454-285e109c27df'

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const db = createAdminClient() as unknown as {
    from: (t: string) => never
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  }
  const q = createAdminClient() as unknown as {
    from: (t: string) => {
      select: (s: string) => { in: (c: string, v: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }>; eq: (c: string, v: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> }
      update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
    }
  }

  const { data: fichas } = await q.from('members').select('id, first_name, last_name, email, external_id, is_active, auth_user_id').in('id', [KEEP, DUP])
  const rows = (fichas ?? []) as Array<{ id: string; external_id: string | null; is_active: boolean; auth_user_id: string | null }>
  if (rows.length !== 2) { console.log('✗ no están las dos fichas'); process.exit(1) }
  const keep = rows.find(r => r.id === KEEP)!
  const dup = rows.find(r => r.id === DUP)!
  console.log(`conserva  ${keep.external_id} · activa=${keep.is_active} · cuenta=${keep.auth_user_id ? 'sí' : 'no'}`)
  console.log(`absorbe   ${dup.external_id} · activa=${dup.is_active} · cuenta=${dup.auth_user_id ? 'sí' : 'no'}`)

  const { data: ins } = await q.from('study_enrollments').select('id, group_id, status, member_id').in('member_id', [KEEP, DUP])
  console.log(`\nmatrículas en juego: ${(ins ?? []).length}`)

  if (!APLICAR) {
    console.log('\n(dry-run) haría:')
    if (!keep.auth_user_id && dup.auth_user_id) console.log('  1. pasar la cuenta de acceso de la duplicada a la que se conserva')
    console.log('  2. merge_members(conserva, duplicada) — mueve todo y borra la matrícula repetida del mismo grupo')
    console.log('  3. dejar la ficha conservada ACTIVA')
    return
  }

  writeFileSync('scripts/output/merge-vilma-2026-08-31-antes.json',
    JSON.stringify({ fichas: rows, matriculas: ins }, null, 2))
  console.log('\nrespaldo → scripts/output/merge-vilma-2026-08-31-antes.json')

  // 1) La cuenta de acceso. Se libera de la duplicada primero: auth_user_id es
  //    único, así que asignarlo sin soltarlo antes choca.
  if (!keep.auth_user_id && dup.auth_user_id) {
    const cuenta = dup.auth_user_id
    let r = await q.from('members').update({ auth_user_id: null }).eq('id', DUP)
    if (r.error) throw new Error(`soltar cuenta: ${r.error.message}`)
    r = await q.from('members').update({ auth_user_id: cuenta }).eq('id', KEEP)
    if (r.error) throw new Error(`pasar cuenta: ${r.error.message}`)
    console.log('  ✓ cuenta de acceso movida a la ficha que se conserva')
  }

  // 2) La fusión.
  const { error } = await db.rpc('merge_members', { keep_id: KEEP, dup_id: DUP, soft: false })
  if (error) throw new Error(`merge_members: ${error.message}`)
  console.log('  ✓ fusionadas')

  // 3) Activa, como pidió el usuario.
  const r = await q.from('members').update({ is_active: true, deactivated_at: null, deactivation_reason: null }).eq('id', KEEP)
  if (r.error) throw new Error(`activar: ${r.error.message}`)
  console.log('  ✓ ficha activa')

  const { data: fin } = await q.from('members').select('id, first_name, last_name, email, external_id, is_active, auth_user_id').eq('id', KEEP)
  console.log('\nqueda:', JSON.stringify((fin ?? [])[0]))
  const { data: insFin } = await q.from('study_enrollments').select('id, group_id, status').eq('member_id', KEEP)
  console.log(`matrículas ahora: ${(insFin ?? []).length}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
