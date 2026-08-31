/**
 * Los 4 casos que la sincronización de correos no podía resolver sola: la
 * persona se registró por su cuenta con el correo nuevo, y quedó con DOS
 * cuentas de Auth.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/religar-cuentas-duplicadas.ts
 *   aplicar:  ... --aplicar
 *
 * Es el mismo patrón que Adriana Jiménez, y por eso se puede automatizar: la
 * ficha apunta a una cuenta que NUNCA se usó, y existe otra —con el correo de
 * la ficha, confirmada, con ingresos y sin ficha— que es la que la persona usa
 * de verdad. La ficha pasa a apuntar a esa, y la que nunca se usó se borra.
 *
 * Las tres condiciones se verifican POR FILA antes de tocar nada. Si alguna no
 * se cumple —por ejemplo si la vieja sí se usó— ese caso se salta: ahí habría
 * historia en las dos cuentas y elegir una es perder la otra.
 */
import { writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

type Fila = {
  member_id: string; persona: string; ficha: string
  vieja: string; vieja_email: string; vieja_uso: boolean
  nueva: string; nueva_confirmada: boolean; nueva_uso: boolean; nueva_fichas: string
}

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const { rows } = await c.query<Fila>(`
    select m.id member_id, m.first_name||' '||m.last_name persona, m.email ficha,
           uv.id vieja, uv.email vieja_email, uv.last_sign_in_at is not null vieja_uso,
           un.id nueva, un.email_confirmed_at is not null nueva_confirmada,
           un.last_sign_in_at is not null nueva_uso,
           (select count(*) from members m2 where m2.auth_user_id = un.id) nueva_fichas
    from members m
    join auth.users uv on uv.id = m.auth_user_id
    join auth.users un on lower(un.email) = lower(m.email) and un.id <> uv.id
    order by persona`)

  console.log(`casos: ${rows.length}\n`)
  const seguros: Fila[] = []
  for (const r of rows) {
    // La vieja NO se usó, la nueva SÍ y está confirmada, y la nueva no le
    // pertenece a nadie más. Sin las tres, no se toca.
    const ok = !r.vieja_uso && r.nueva_uso && r.nueva_confirmada && Number(r.nueva_fichas) === 0
    console.log(`  ${ok ? '✓' : '⚠'} ${r.persona}`)
    console.log(`      ficha: ${r.ficha}`)
    console.log(`      ligada a ${r.vieja_email} (usada: ${r.vieja_uso ? 'SÍ' : 'no'}) → se borra`)
    console.log(`      pasa a la cuenta que usa (confirmada: ${r.nueva_confirmada ? 'sí' : 'NO'}, ingresó: ${r.nueva_uso ? 'sí' : 'NO'}, fichas: ${r.nueva_fichas})`)
    if (!ok) console.log('      ↑ no cumple las condiciones — se salta')
    else seguros.push(r)
  }

  if (!seguros.length) { console.log('\nnada que aplicar'); await c.end(); return }
  if (!APLICAR) { console.log(`\n(dry-run) religaría ${seguros.length}. Correlo con --aplicar.`); await c.end(); return }

  writeFileSync('scripts/output/religar-cuentas-2026-08-31-antes.json', JSON.stringify(rows, null, 2))
  console.log('\nrespaldo → scripts/output/religar-cuentas-2026-08-31-antes.json\n── aplicando ──')
  let ok = 0
  for (const r of seguros) {
    try {
      await c.query('begin')
      await c.query('update members set auth_user_id=$2, updated_at=now() where id=$1', [r.member_id, r.nueva])
      // Borrado por SQL: el admin API de Auth da 500 en este proyecto para
      // borrar (mismo gotcha que el cambio de correo con colisión).
      await c.query('delete from auth.identities where user_id=$1', [r.vieja])
      await c.query('delete from auth.users where id=$1', [r.vieja])
      await c.query('commit')
      console.log(`  ✓ ${r.persona}`)
      ok++
    } catch (e) {
      await c.query('rollback')
      console.log(`  ✗ ${r.persona}: ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`\n  religadas: ${ok}/${seguros.length}`)
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
