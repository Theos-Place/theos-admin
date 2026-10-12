/**
 * Desbloquea las cuentas de ADULTOS con ficha viva que quedaron bloqueadas.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/daniela-2026-10/desbloquear-adultos.ts
 *   aplicar:  ... --aplicar
 *
 * EL BLOQUEO ES LA REGLA PARA MENORES (AUTH-1) y no se toca. Lo que este
 * script corrige son los adultos que quedaron adentro, y salieron de dos
 * caminos distintos (medido el 2026-10-12, a raíz del reporte de Daniela
 * Céspedes):
 *
 *  1 · CUMPLIERON 18 Y EL CRON NO HA PASADO. `desbloquear-mayores` corre el
 *      día 1 de cada mes (`0 13 1 * *`), así que quien cumple el 3 espera 29
 *      días. Cinco personas cumplieron entre el 3 y el 12 de octubre.
 *
 *  2 · HEREDARON UNA CUENTA BLOQUEADA AL FUSIONAR FICHAS. La ficha
 *      sobreviviente se queda con la cuenta del duplicado; si esa estaba
 *      bloqueada —por ser de un menor, o por el propio alias de fusión— el
 *      adulto hereda el bloqueo. A estos el cron NO los ve: solo mira a
 *      nacidos en los últimos 19 años, y Lidia tiene 69.
 *
 * SOLO ADULTOS CON FICHA VIVA. Un menor sigue bloqueado, y una ficha
 * inactiva no recupera su cuenta: ahí el bloqueo es lo correcto.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const APLICAR = process.argv.includes('--aplicar')
async function main() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const sb = createAdminClient()

  /**
   * QUIÉN ESTÁ BLOQUEADO SE PREGUNTA EN SQL, no enumerando miembros por
   * PostgREST. El primer intento de este script pidió los adultos con cuenta
   * y recibió EXACTAMENTE 1.000 — el tope de PostgREST — así que revisó el
   * 11% y reportó «0 bloqueados». Es el mismo error que el propio cron
   * `desbloquear-mayores` ya había cometido y documentado.
   *
   * `auth.users` no se puede consultar por PostgREST, pero sí por SQL
   * directo, y ahí el filtro `banned_until > now()` reduce 8.929 fichas a un
   * puñado. Desbloquear sigue yendo por la API de Auth: el estado lo lleva
   * Auth y tocarlo por SQL dejaría su caché diciendo otra cosa.
   */
  const { nuevoCliente } = await import('../madre-2026-09/lib.cjs') as {
    nuevoCliente: () => { connect: () => Promise<void>; query: (q: string) => Promise<{ rows: Fila[] }>; end: () => Promise<void> }
  }
  type Fila = { auth_id: string; persona: string; correo: string | null; edad: number }
  const pg = nuevoCliente()
  await pg.connect()
  const { rows } = await pg.query(`
    select u.id as auth_id,
           m.first_name || ' ' || m.last_name as persona,
           u.email as correo,
           extract(year from age(m.birth_date))::int as edad
    from auth.users u
    join members m on m.auth_user_id = u.id
    where u.banned_until > now()
      and m.is_active
      and m.birth_date is not null
      and extract(year from age(m.birth_date)) >= 18
    order by 4 desc`)
  await pg.end()

  const bloqueados = rows.map(r => ({
    nombre: r.persona, email: r.correo, edad: r.edad, authId: r.auth_id,
  }))

  console.log(`\nbloqueados que NO deberían estarlo: ${bloqueados.length}`)
  console.table(bloqueados.map(b => ({ persona: b.nombre, edad: b.edad, correo: b.email })))

  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); return }
  if (!bloqueados.length) return

  const respaldo = join(__dirname, `rollback-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  writeFileSync(respaldo, JSON.stringify(bloqueados, null, 2))

  let ok = 0
  for (const b of bloqueados) {
    const { error: e } = await sb.auth.admin.updateUserById(b.authId, { ban_duration: 'none' })
    if (e) { console.log(`  ✗ ${b.nombre}: ${e.message}`); continue }
    ok++
    console.log(`  ✓ ${b.nombre}`)
  }
  console.log(`\ndesbloqueadas: ${ok} de ${bloqueados.length}\nrespaldo: ${respaldo}`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
