/**
 * Dos cosas pedidas el 2026-09-10:
 *
 *  1. Borrar los dos eventos de prueba del 7-sep. Se llevan en cascada 7
 *     check-ins y 1 sub-evento, todos de la misma prueba.
 *  2. Actualizar a Otto y Cristina con lo que trae la hoja del 8-sep, que es la
 *     información más reciente — incluidos los nombres más completos.
 *
 * QUÉ NO SE TOCA Y POR QUÉ: los dos CORREOS. No es timidez, son dos riesgos
 * concretos:
 *
 *  · Otto tiene cuenta de acceso. members.email y auth.users.email son campos
 *    distintos: cambiar el primero deja su perfil con una dirección y su login
 *    con otra. Y la dirección nueva (ottoalfredo@oac.cr) es una de las dos que
 *    la propia hoja marca POR VERIFICAR.
 *  · Cristina pasa de crisroza7@hotmail.com a crisroza07@gmail.com: cambia el
 *    dominio Y el usuario. Eso no parece una corrección de transcripción sino
 *    una segunda dirección, y pisar la vieja perdería la que hoy funciona.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-charla-2026-09-08/limpiar-y-actualizar.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-charla-2026-09-08/limpiar-y-actualizar.ts --aplicar
 */
import { readFileSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const EVENTOS_A_BORRAR = [
  { id: '7eab5319-f548-482a-849a-847dbe2522ed', titulo: '[PRUEBA] Charla con Youth' },
  { id: 'fb0d49fb-47f5-495d-aabe-26c34c38fee6', titulo: '[PRUEBA] Charla sin Youth' },
]

/** Los cambios vienen de la hoja del 8-sep. Solo nombres: ver la cabecera. */
const ACTUALIZAR = [
  {
    buscarPorTelefono: '88850898',
    esperado: 'Otto Chaves',
    cambios: { first_name: 'Otto Alfredo', last_name: 'Cheves Campos' },
  },
  {
    buscarPorTelefono: '88193335',
    esperado: 'Cristina Rojas',
    cambios: { last_name: 'Rojas Zapata' },
  },
]

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const { updateMember } = await import('../../src/lib/supabase/queries/members')
  const sb = createAdminClient()

  console.log('BORRAR EVENTOS DE PRUEBA')
  for (const e of EVENTOS_A_BORRAR) {
    const { data: ev } = await sb.from('events').select('id, title').eq('id', e.id).maybeSingle()
    if (!ev) { console.log(`  · ${e.titulo}: ya no existe`); continue }
    // Se comprueba el título antes de borrar: un id copiado mal borraría un
    // evento real sin que nadie se entere hasta que falte.
    if ((ev as { title: string }).title !== e.titulo) {
      throw new Error(`El evento ${e.id} se llama «${(ev as { title: string }).title}» y no «${e.titulo}». Se aborta.`)
    }
    const { count: ck } = await sb.from('event_checkins').select('id', { count: 'exact', head: true }).eq('event_id', e.id)
    const { count: sub } = await sb.from('sub_events').select('id', { count: 'exact', head: true }).eq('event_id', e.id)
    if (!aplicar) {
      console.log(`  [simulacro] ${e.titulo} → se borraría con ${ck} check-ins y ${sub} sub-eventos (cascada)`)
      continue
    }
    const { error } = await sb.from('events').delete().eq('id', e.id)
    if (error) throw error
    console.log(`  ✓ ${e.titulo} borrado (${ck} check-ins, ${sub} sub-eventos)`)
  }

  console.log('\nACTUALIZAR NOMBRES')
  for (const u of ACTUALIZAR) {
    const { data } = await sb.from('members')
      .select('id, first_name, last_name, email, phone')
      .eq('phone', u.buscarPorTelefono)
    const filas = (data ?? []) as Array<{ id: string; first_name: string; last_name: string; email: string | null }>
    if (filas.length !== 1) {
      console.log(`  ⚠️  ${u.esperado}: ${filas.length} fichas con ese teléfono — se omite`)
      continue
    }
    const m = filas[0]
    const actual = `${m.first_name} ${m.last_name}`.trim()
    if (actual !== u.esperado) {
      console.log(`  ⚠️  se esperaba «${u.esperado}» y la ficha dice «${actual}» — se omite`)
      continue
    }
    const nuevo = `${u.cambios.first_name ?? m.first_name} ${u.cambios.last_name ?? m.last_name}`.trim()
    if (!aplicar) {
      console.log(`  [simulacro] «${actual}» → «${nuevo}»`)
      console.log(`              correo SIN tocar: ${m.email}`)
      continue
    }
    await updateMember(m.id, u.cambios as Parameters<typeof updateMember>[1])
    console.log(`  ✓ «${actual}» → «${nuevo}»  (correo intacto: ${m.email})`)
  }

  if (!aplicar) console.log('\nSIMULACRO. Nada se escribió. Volvé a correrlo con --aplicar.')
}

main().catch(e => { console.error(e); process.exit(1) })
