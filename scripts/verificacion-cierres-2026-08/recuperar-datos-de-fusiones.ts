/**
 * Devuelve los datos personales que las FUSIONES de miembros borraron.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/recuperar-datos-de-fusiones.ts
 *   aplicar:  ... --aplicar
 *
 * merge_members mueve matrículas, pagos, roles y familia, pero de la FICHA
 * duplicada no rescata nada: la borra entera. Si el correo, la cédula, la
 * dirección o el contacto de emergencia solo estaban ahí, se pierden — y la
 * ficha que sobrevive queda peor que antes de fusionar.
 *
 * Se recupera del `audit_log`: la eliminación guarda `old_data` con la fila
 * completa. Reportado con Ariana Chaves Duarte, que perdió correo, cédula,
 * dirección, contacto de emergencia y su cuenta de acceso.
 *
 * REGLA: solo se rellenan campos VACÍOS en la ficha que quedó. Nunca se pisa un
 * dato existente — si los dos tenían algo distinto, el que sobrevivió es el que
 * alguien eligió conservar.
 */
import { writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/** Lo que NO se restaura: identidad de la fila, derivados y marcas técnicas.
 *
 *  `search_text` y `cedula_normalized` son columnas GENERADAS: Postgres las
 *  recalcula y rechaza el UPDATE con "can only be updated to DEFAULT". Se
 *  arreglan solas al restaurar `cedula`. */
const NO_TOCAR = new Set([
  'id', 'created_at', 'updated_at', 'search_text', 'cedula_normalized', 'field_updated_at',
  'external_id', 'smart_link_token', 'unsubscribe_token', 'wallet_pass_id',
  'is_system', 'is_active', 'deactivated_at', 'deactivated_by', 'deactivation_reason',
  'cedula_dup_legacy', 'auth_user_id', // la cuenta va aparte, con sus guardas
])

const vacio = (x: unknown) =>
  x === null || x === undefined || x === ''
  || (typeof x === 'object' && !(x instanceof Date) && Object.keys(x as object).length === 0)

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\./)![1]
  const c = new Client({
    connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // Cada MERGE tiene su DELETE a segundos de distancia: es la ficha absorbida.
  const { rows: fusiones } = await c.query<{ conservada: string; cuando: Date; borrada: string; old_data: Record<string, unknown> }>(`
    select mg.entity_id conservada, mg.created_at cuando, dl.entity_id borrada, dl.old_data
    from audit_log mg
    join lateral (
      select d.entity_id, d.old_data from audit_log d
      where d.action='DELETE' and d.entity_type='members' and d.old_data is not null
        and abs(extract(epoch from (d.created_at - mg.created_at))) < 30
      order by abs(extract(epoch from (d.created_at - mg.created_at))) limit 1
    ) dl on true
    where mg.action='MERGE' and mg.entity_type='members'
    order by mg.created_at desc`)
  console.log(`fusiones con respaldo en la bitácora: ${fusiones.length}\n`)

  const planes: Array<{ id: string; nombre: string; patch: Record<string, unknown>; cuenta: string | null }> = []
  for (const f of fusiones) {
    const { rows: [viva] } = await c.query(`select * from members where id=$1`, [f.conservada])
    if (!viva) { console.log(`· ${f.conservada}: la ficha conservada ya no existe`); continue }
    const nombre = `${viva.first_name} ${viva.last_name}`

    const patch: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(f.old_data)) {
      if (NO_TOCAR.has(k) || vacio(v)) continue
      if (!(k in viva)) continue                 // columna que ya no existe
      if (!vacio(viva[k])) continue              // hay dato: no se pisa
      patch[k] = v
    }

    // La cuenta de acceso: solo si la ficha quedó sin ninguna, la cuenta sigue
    // existiendo y no es de nadie más. Sin esto la persona entra y no ve nada.
    let cuenta: string | null = null
    const authId = f.old_data.auth_user_id as string | null
    if (!viva.auth_user_id && authId) {
      const { rows: [u] } = await c.query(
        `select u.id, (select count(*) from members m where m.auth_user_id=u.id) fichas
         from auth.users u where u.id=$1`, [authId])
      if (u && Number(u.fichas) === 0) cuenta = authId
    }

    if (!Object.keys(patch).length && !cuenta) { console.log(`✓ ${nombre}: no perdió nada`); continue }
    console.log(`⚠ ${nombre}  (${f.cuando.toISOString().slice(0, 10)})`)
    for (const [k, v] of Object.entries(patch)) console.log(`    ${k.padEnd(26)} ${JSON.stringify(v)}`)
    if (cuenta) console.log(`    ${'auth_user_id'.padEnd(26)} ${cuenta}  ← recupera su acceso`)
    planes.push({ id: f.conservada, nombre, patch, cuenta })
  }

  if (!planes.length) { console.log('\nnada que recuperar'); await c.end(); return }
  if (!APLICAR) { console.log(`\n(dry-run) restauraría ${planes.length} fichas. Correlo con --aplicar.`); await c.end(); return }

  writeFileSync('scripts/output/recuperar-fusiones-2026-09-01-antes.json', JSON.stringify(planes, null, 2))
  console.log('\nrespaldo → scripts/output/recuperar-fusiones-2026-09-01-antes.json\n── aplicando ──')
  let ok = 0
  for (const p of planes) {
    const campos = { ...p.patch, ...(p.cuenta ? { auth_user_id: p.cuenta } : {}) }
    const cols = Object.keys(campos)
    const sets = cols.map((k, i) => `"${k}" = $${i + 2}`).join(', ')
    try {
      await c.query(`update members set ${sets}, updated_at = now() where id = $1`, [p.id, ...cols.map(k => campos[k])])
      console.log(`  ✓ ${p.nombre} (${cols.length} campos)`)
      ok++
    } catch (e) {
      console.log(`  ✗ ${p.nombre}: ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`\n  fichas restauradas: ${ok}/${planes.length}`)
  await c.end()
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
