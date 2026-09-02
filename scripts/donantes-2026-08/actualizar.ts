/**
 * Marca como donante a la gente de la lista de CCB que todavía no lo está.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/donantes-2026-08/actualizar.ts
 *   aplicar:  ... actualizar.ts --aplicar
 *
 * El archivo (data-import/donantes-2026-08.csv) es el export de participantes
 * de los grupos "Donantes" de CCB: cinco grupos por trimestre, 1.563 filas y
 * 711 personas distintas —la mayoría aparece en varios trimestres.
 *
 * SOLO AGREGA, decisión del usuario. Hay 22 personas marcadas hoy que no están
 * en el archivo y NO se desmarcan: la petición fue "agregar los que no estén",
 * y desmarcar a alguien que donó antes es una afirmación distinta —"ya no
 * dona"— que este archivo no respalda por sí solo.
 *
 * El match es por external_id (la columna "Ind ID"), que es el id de CCB y está
 * en las 711 filas. Nada de match por nombre: acá no hace falta y sería peor.
 */
import { readFileSync } from 'node:fs'
import { cargarEnv, todo, type Miembro } from '../verificacion-cierres-2026-08/lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')
const ARCHIVO = 'data-import/donantes-2026-08.csv'

/** CSV con comillas y BOM (el export de CCB trae los dos). */
function leerCsv(ruta: string): Array<Record<string, string>> {
  const txt = readFileSync(ruta, 'utf8')
  const filas: string[][] = []
  let campo = '', fila: string[] = [], enComillas = false
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i]
    if (enComillas) {
      if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') enComillas = false
      else campo += c
    } else if (c === '"') enComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  const [cab, ...resto] = filas
  return resto.filter(f => f.some(v => v.trim()))
    .map(f => Object.fromEntries(cab.map((k, i) => [k.replace(/^﻿/, '').trim(), (f[i] ?? '').trim()])))
}

type MiembroDonante = Miembro & { is_donor: boolean }

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]
  const db = createAdminClient() as unknown as { from: (t: string) => never }

  const filas = leerCsv(ARCHIVO)
  const porExternalCsv = new Map<string, string>()
  for (const r of filas) {
    const ext = String(r['Ind ID'] ?? '').trim()
    if (ext) porExternalCsv.set(ext, r['Name'] ?? '')
  }

  const miembros = await todo<MiembroDonante>(admin, 'members', 'id, external_id, first_name, last_name, is_donor')
  const porExternal = new Map(miembros.filter(m => m.external_id).map(m => [String(m.external_id).trim(), m]))

  const aMarcar: MiembroDonante[] = []
  const sinFicha: string[] = []
  let yaEstaban = 0
  for (const [ext, nombre] of porExternalCsv) {
    const m = porExternal.get(ext)
    if (!m) { sinFicha.push(`${ext} · ${nombre}`); continue }
    if (m.is_donor) { yaEstaban++; continue }
    aMarcar.push(m)
  }
  const marcadosFueraDelCsv = miembros.filter(m =>
    m.is_donor && (!m.external_id || !porExternalCsv.has(String(m.external_id).trim())))

  console.log('══ RESUMEN ══')
  console.log(`  filas del archivo:                 ${filas.length}`)
  console.log(`  personas distintas:                ${porExternalCsv.size}`)
  console.log(`  ─────────────────────────────────`)
  console.log(`  ya marcadas como donante:          ${yaEstaban}`)
  console.log(`  A MARCAR:                          ${aMarcar.length}`)
  console.log(`  sin ficha en la base:              ${sinFicha.length}`)
  console.log(`\n  marcadas hoy que NO están en el archivo: ${marcadosFueraDelCsv.length} (no se tocan)`)
  if (sinFicha.length) {
    console.log('\n  SIN FICHA — no se crean, se reportan:')
    for (const s of sinFicha) console.log(`    · ${s}`)
  }
  console.log('\n  se marcarían:')
  for (const m of aMarcar) console.log(`    ${String(m.external_id).padStart(6)}  ${m.first_name} ${m.last_name}`)

  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }
  if (!aMarcar.length) { console.log('\nNada que hacer.'); return }

  console.log('\n── aplicando ──')
  let ok = 0
  for (const grupo of Array.from({ length: Math.ceil(aMarcar.length / 100) }, (_, i) => aMarcar.slice(i * 100, i * 100 + 100))) {
    const { error, count } = await (db.from('members') as never as {
      update: (v: unknown, o: unknown) => { in: (c: string, v: string[]) => { eq: (c2: string, v2: boolean) => Promise<{ error: { message: string } | null; count: number | null }> } }
    })
      // `.eq('is_donor', false)` es la guarda: solo toca a quien NO lo era, así
      // el conteo que se reporta es el de cambios reales.
      .update({ is_donor: true }, { count: 'exact' })
      .in('id', grupo.map(m => m.id))
      .eq('is_donor', false)
    if (error) { console.log(`  ✗ ${error.message}`); continue }
    ok += count ?? 0
  }
  console.log(`  marcados: ${ok}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
