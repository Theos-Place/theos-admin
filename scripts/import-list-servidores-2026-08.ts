/**
 * One-off: crea la lista guardada "Servidores — agosto 2026" en /miembros/listas
 * a partir de data-import/servidores-2026-08-10.csv (export de CCB del 10 de
 * agosto 2026).
 *
 * Uso (OJO con NODE_OPTIONS: member-lists.ts hace `import 'server-only'`, que
 * revienta en tsx sin la condición react-server):
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-list-servidores-2026-08.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-list-servidores-2026-08.ts --commit
 *
 * Sin --commit solo imprime el reporte y NO escribe nada.
 *
 * Hermano de scripts/import-list-servidores-campa-2026.ts (misma operación, otro
 * archivo). Dos diferencias que importan:
 *
 *  1) EL CSV ES DE ASIGNACIONES, NO DE PERSONAS: trae una fila por
 *     persona+puesto+comité, así que la misma persona sale varias veces. Se
 *     AGRUPA POR external_id ANTES de matchear; la lista es de personas.
 *  2) EL FALLBACK ES POR CORREO, NO POR NOMBRE. El script viejo pegaba por
 *     nombre normalizado, y un homónimo mete a la persona equivocada en una
 *     lista de envíos. Acá el fallback es el correo (case-insensitive) y va
 *     marcado aparte en el reporte para revisión humana.
 *
 * La lista se crea con createMemberList(), el mismo camino que usa la pantalla
 * de listas guardadas, para que queden bien todos los campos y se pueda elegir
 * como audiencia en /comunicaciones igual que cualquier otra. Es ESTÁTICA: los
 * ids van en member_ids y no se recalcula sola.
 *
 * NO toca ningún dato de miembros: solo lee members y crea una fila en member_lists.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

for (const file of ['.env', '.env.local']) {
  try {
    const t = readFileSync(join(process.cwd(), file), 'utf8')
    for (const line of t.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sigue */ }
}

const CSV = 'data-import/servidores-2026-08-10.csv'
const LIST_NAME = 'Servidores — agosto 2026'
/** La lista anterior del mismo universo. No se toca: solo se reporta para que
 *  la decisión de archivarla la tome una persona. */
const LISTA_ANTERIOR = 'Servidores comprometidos Campa 2026'

/** Igual que el resto de los importadores del repo (group-import-rules, vacancy-import). */
const norm = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

/** Los apodos del export vienen como Carlos "Caco" Chavarria o Arnoldo (Nono)
 *  Moreno; el padrón guarda el nombre legal. Solo se usa para el CONTROL de
 *  sanidad del match por ID — nunca para matchear. */
const normName = (s: string) => norm((s ?? '').replace(/"[^"]*"/g, ' ').replace(/\([^)]*\)/g, ' '))

/** El correo es identidad acá: se compara en minúsculas y sin espacios. */
const normEmail = (s: string) => (s ?? '').trim().toLowerCase()

/** CSV con comillas dobles al estilo Excel (""..."" dentro de un campo citado). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(v => v.trim() !== ''))
}

type Member = {
  id: string
  external_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  email_bounced: boolean | null
  is_active: boolean | null
  is_system: boolean | null
}

const fullName = (m: Member) => `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()

/** Una PERSONA del CSV: el resultado de agrupar sus filas de asignación. */
type Persona = {
  id: string
  nombre: string
  email: string
  /** Líneas del CSV que la mencionan (para poder rastrear el dato original). */
  lineas: number[]
  /** puesto · comité, una por asignación. */
  asignaciones: string[]
}

async function main() {
  const commit = process.argv.includes('--commit')
  const { createAdminClient } = await import('../src/lib/supabase/admin')
  const { createMemberList, getMemberLists } = await import('../src/lib/supabase/queries/member-lists')
  const db = createAdminClient()

  // ── CSV ──────────────────────────────────────────────────────────────────
  const rows = parseCsv(readFileSync(CSV, 'utf8'))
  const header = rows[0].map(h => h.trim())
  const col = (name: string) => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`El CSV no trae la columna "${name}": ${header.join(',')}`)
    return i
  }
  const iId = col('external_id')
  const iFirst = col('first_name')
  const iLast = col('last_name')
  const iPos = col('position_name')
  const iTeam = col('team_name')
  const iEmail = col('email')

  const totalFilas = rows.length - 1

  // ── 1) DEDUPE POR PERSONA ────────────────────────────────────────────────
  // El CSV es de asignaciones: la misma persona aparece una vez por puesto.
  // Se agrupa por external_id; las filas SIN external_id no se pueden agrupar
  // de forma confiable, así que se agrupan por correo y se reportan aparte.
  const personas = new Map<string, Persona>()
  const sinIdNiCorreo: number[] = []

  rows.slice(1).forEach((r, idx) => {
    const linea = idx + 2
    const id = (r[iId] ?? '').trim()
    const email = normEmail(r[iEmail] ?? '')
    const nombre = `${(r[iFirst] ?? '').trim()} ${(r[iLast] ?? '').trim()}`.trim()
    const asignacion = `${(r[iPos] ?? '').trim()} · ${(r[iTeam] ?? '').trim()}`

    // Clave de agrupación: el ID manda; sin ID, el correo. Sin ninguno de los
    // dos la fila no se puede identificar y se reporta.
    const clave = id ? `id:${id}` : email ? `mail:${email}` : ''
    if (!clave) { sinIdNiCorreo.push(linea); return }

    const prev = personas.get(clave)
    if (prev) {
      prev.lineas.push(linea)
      prev.asignaciones.push(asignacion)
      // El correo puede venir vacío en una fila y lleno en otra: se conserva el primero que aparezca.
      if (!prev.email && email) prev.email = email
    } else {
      personas.set(clave, { id, nombre, email, lineas: [linea], asignaciones: [asignacion] })
    }
  })
  const gente = [...personas.values()]

  // ── Padrón completo (paginado: PostgREST corta en 1000) ──────────────────
  const members: Member[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('members')
      .select('id, external_id, first_name, last_name, email, email_bounced, is_active, is_system')
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    const page = (data ?? []) as Member[]
    members.push(...page)
    if (page.length < 1000) break
  }

  const byExternal = new Map<string, Member[]>()
  const byEmail = new Map<string, Member[]>()
  for (const m of members) {
    const ext = (m.external_id ?? '').trim()
    if (ext) byExternal.set(ext, [...(byExternal.get(ext) ?? []), m])
    const e = normEmail(m.email ?? '')
    if (e) byEmail.set(e, [...(byEmail.get(e) ?? []), m])
  }

  // ── 2) MATCHEO ──────────────────────────────────────────────────────────
  type Hit = { p: Persona; member: Member; via: 'external_id' | 'correo' }
  const porExternalId: Hit[] = []
  const porCorreo: Hit[] = []
  const ambiguos: Array<{ p: Persona; candidatos: Member[]; via: string }> = []
  const descartados: Array<{ p: Persona; member: Member; motivo: string; via: string }> = []
  const sinMatch: Persona[] = []

  const usable = (m: Member) => m.is_active !== false && m.is_system !== true
  const motivo = (m: Member) =>
    m.is_system === true ? 'ficha del sistema' : m.is_active === false ? 'inactivo' : ''

  for (const p of gente) {
    // a) external_id — match exacto, ambos lados como texto sin espacios.
    const porExt = p.id ? byExternal.get(p.id) ?? [] : []
    if (porExt.length === 1) {
      const m = porExt[0]
      if (usable(m)) porExternalId.push({ p, member: m, via: 'external_id' })
      else descartados.push({ p, member: m, motivo: motivo(m), via: 'external_id' })
      continue
    }
    if (porExt.length > 1) {
      ambiguos.push({ p, candidatos: porExt, via: 'external_id repetido en members' })
      continue
    }

    // b) Fallback por CORREO. Nunca por nombre: un homónimo metería a la
    //    persona equivocada en una lista de envíos.
    const cand = p.email ? byEmail.get(p.email) ?? [] : []
    const vivos = cand.filter(usable)
    if (vivos.length === 1) { porCorreo.push({ p, member: vivos[0], via: 'correo' }); continue }
    if (vivos.length > 1) { ambiguos.push({ p, candidatos: vivos, via: 'mismo correo en varios miembros' }); continue }
    if (cand.length >= 1) {
      for (const m of cand) descartados.push({ p, member: m, motivo: motivo(m), via: 'correo' })
      continue
    }
    sinMatch.push(p)
  }

  // Dos personas del CSV pueden caer en el mismo miembro (ID en una, correo en
  // otra): la lista va sin repetidos.
  const hits = [...porExternalId, ...porCorreo]
  const idsUnicos: string[] = []
  const vistos = new Set<string>()
  const colisiones: Hit[] = []
  for (const h of hits) {
    if (!vistos.has(h.member.id)) { vistos.add(h.member.id); idsUnicos.push(h.member.id) }
    else colisiones.push(h)
  }

  const byId = new Map(members.map(m => [m.id, m]))
  const seleccionados = idsUnicos.map(id => byId.get(id)!)
  const sinCorreo = seleccionados.filter(m => !(m.email ?? '').trim())
  const rebotados = seleccionados.filter(m => m.email_bounced === true && (m.email ?? '').trim())

  // ── 3) REPORTE ──────────────────────────────────────────────────────────
  const L = (s = '') => console.log(s)
  L(`CSV: ${CSV}`)
  L(`  Filas de asignación : ${totalFilas}`)
  L(`  Personas únicas     : ${gente.length}   (agrupadas por external_id)`)
  L(`Padrón leído: ${members.length} miembros`)
  L()
  L('── RESUMEN DEL MATCHEO ─────────────────────────────')
  L(`  Match por external_id             : ${porExternalId.length}`)
  L(`  Match por correo (REVISAR)        : ${porCorreo.length}`)
  L(`  Ambiguos (NO se incluyen)         : ${ambiguos.length}`)
  L(`  Descartados por estado del padrón : ${descartados.length}`)
  L(`  Sin match                         : ${sinMatch.length}`)
  L(`  ─────────────────────────────────────────────────`)
  L(`  Miembros únicos en la lista       : ${idsUnicos.length}`)
  if (colisiones.length) L(`  (${colisiones.length} persona(s) del CSV cayeron en un miembro ya incluido)`)
  if (sinIdNiCorreo.length) L(`  ⚠ Filas sin external_id NI correo (ignoradas): ${sinIdNiCorreo.join(', ')}`)
  L()
  L('── ENVÍO: a cuántos NO les va a llegar ──────────────')
  L(`  Sin correo en el padrón : ${sinCorreo.length}`)
  L(`  Con correo rebotado     : ${rebotados.length}   (el sistema los salta)`)
  L(`  Reciben el correo       : ${idsUnicos.length - sinCorreo.length - rebotados.length}`)
  if (sinCorreo.length) {
    L('  Sin correo en el padrón:')
    for (const m of sinCorreo) L(`    · ${fullName(m)} (CCB ${m.external_id ?? '—'})`)
  }
  if (rebotados.length) {
    L('  Con correo rebotado:')
    for (const m of rebotados) L(`    · ${fullName(m)} <${m.email}> (CCB ${m.external_id ?? '—'})`)
  }

  // Control de sanidad del match por ID: el ID es ciego, así que si la migración
  // hubiera corrido los external_id, la lista quedaría mal sin que nada avise.
  // Comparar el nombre del export contra el del padrón lo delata.
  const nombreDistinto = porExternalId.filter(h => normName(h.p.nombre) !== normName(fullName(h.member)))
  L()
  L('── CONTROL: el external_id apunta a la persona correcta ─')
  L(`  Nombre idéntico al del export : ${porExternalId.length - nombreDistinto.length} de ${porExternalId.length}`)
  L(`  Nombre distinto (revisar)     : ${nombreDistinto.length}`)
  for (const h of nombreDistinto) {
    L(`    · CCB ${h.p.id}: export "${h.p.nombre}" → padrón "${fullName(h.member)}"`)
  }

  if (porCorreo.length) {
    L()
    L('── MATCHEADOS POR CORREO — revisar uno por uno ──────')
    L('   (el external_id del export no existe en el padrón; se pegó por correo)')
    for (const h of porCorreo) {
      L(`  · export "${h.p.nombre}" (CCB ${h.p.id || '—'}, línea ${h.p.lineas.join('/')}) <${h.p.email || 'sin correo'}>`)
      L(`      → padrón "${fullName(h.member)}"  CCB ${h.member.external_id ?? '—'}  <${h.member.email ?? 'sin correo'}>`)
    }
  }

  if (ambiguos.length) {
    L()
    L('── AMBIGUOS — NO se incluyen ───────────────────────')
    for (const a of ambiguos) {
      L(`  · export "${a.p.nombre}" (CCB ${a.p.id || '—'}, línea ${a.p.lineas.join('/')}) — ${a.via}`)
      for (const m of a.candidatos) L(`      candidato: ${fullName(m)}  CCB ${m.external_id ?? '—'}  <${m.email ?? 'sin correo'}>`)
    }
  }

  if (descartados.length) {
    L()
    L('── DESCARTADOS por estado del padrón ───────────────')
    for (const d of descartados) L(`  · "${d.p.nombre}" (CCB ${d.p.id || '—'}) → ${fullName(d.member)}: ${d.motivo} [match por ${d.via}]`)
  }

  if (sinMatch.length) {
    L()
    L('── SIN MATCH — no están en el padrón ───────────────')
    for (const p of sinMatch) {
      L(`  · "${p.nombre}" (CCB ${p.id || '—'}, línea ${p.lineas.join('/')}) <${p.email || 'sin correo'}>`)
      L(`      ${p.asignaciones.join(' | ')}`)
    }
  }

  // ── 5) LISTAS EXISTENTES: no pisar ni duplicar ──────────────────────────
  L()
  const listas = await getMemberLists()
  const yaExiste = listas.find(l => l.name === LIST_NAME)
  const anterior = listas.find(l => l.name === LISTA_ANTERIOR)
  if (anterior) {
    L(`ℹ Lista anterior del mismo universo (NO se toca): "${anterior.name}" (${anterior.id}, ${anterior.member_count} miembros).`)
  }
  if (yaExiste) {
    L(`⚠ Ya existe una lista "${LIST_NAME}" (${yaExiste.id}, ${yaExiste.member_count} miembros).`)
    L('  Este script no la sobrescribe: borrala en /miembros/listas y volvé a correrlo,')
    L('  o editala desde la pantalla.')
    return
  }
  if (!commit) {
    L('DRY-RUN: no se creó nada. Volvé a correrlo con --commit para crear la lista.')
    return
  }

  // ── 4) CREAR LA LISTA ───────────────────────────────────────────────────
  const list = await createMemberList({
    name: LIST_NAME,
    description: 'Servidores activos según export CCB del 10 de agosto 2026, matcheados por external_id',
    // Estática: no hay filtro del padrón que reproduzca "los del export".
    filters: { conditions: [], groups: [] },
    segment_label: 'Servidores · agosto 2026',
    member_ids: idsUnicos,
    member_count: idsUnicos.length,
    is_dynamic: false,
    tags: ['servidores', '2026-08'],
  })
  L(`✓ Lista creada: "${list.name}" (${list.id}) con ${list.member_count} miembros.`)
  L('  Verificala en /miembros/listas y elegila como audiencia en /comunicaciones.')
}

main().catch(e => { console.error(e); process.exit(1) })
