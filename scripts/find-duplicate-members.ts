/**
 * Busca fichas duplicadas de la MISMA persona en el padrón y saca un CSV para
 * revisar y fusionar. NO escribe nada nunca — es solo un reporte.
 *
 * Uso:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/find-duplicate-members.ts
 *
 * De dónde salió: al mover correos de servidores aparecieron fichas dobles creadas
 * por CCB (un segundo "individual" para alguien que ya existía). Ariana Chaves
 * Duarte, Gabriel Alvarez Gomez, Vilma Tripovic… El patrón es siempre el mismo: la
 * vieja tiene los datos y la cuenta, la nueva está casi vacía.
 *
 * SEÑALES, de más a menos confiable:
 *   cedula   — el documento es el identificador legal: dos fichas con la misma
 *              cédula son la misma persona, punto.
 *   correo   — muy fuerte, pero ojo: familias comparten dirección (ver los pares
 *              de CCB donde marido y mujer traen el mismo correo).
 *   nombre + fecha de nacimiento — dos personas con el mismo nombre Y el mismo día
 *              de nacimiento es prácticamente imposible.
 *   nombre + teléfono — fuerte.
 *   nombre solo — NO se reporta como duplicado. En 23.000 fichas hay homónimos de
 *              verdad y un merge equivocado fusiona a dos personas distintas, que es
 *              muchísimo peor que dejar una ficha doble.
 *
 * Para fusionar (ya existe la función, no hay que inventar nada):
 *   SELECT merge_members('<id_a_conservar>', '<id_duplicado>');
 * Conservar la que tiene la cuenta de acceso y el historial.
 */
import { readFileSync, writeFileSync } from 'node:fs'
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

const OUT = 'data-import/fichas-duplicadas-para-merge.csv'

type M = {
  id: string; first_name: string | null; last_name: string | null
  cedula: string | null; cedula_normalized: string | null
  email: string | null; phone: string | null; birth_date: string | null
  external_id: string | null; auth_user_id: string | null; account_confirmed_at: string | null
  is_active: boolean | null; is_system: boolean | null; created_at: string
  sede_id: string | null; photo_url: string | null
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

async function main() {
  const { norm } = await import('../src/lib/import/ccb-personal-data')
  const { createAdminClient } = await import('../src/lib/supabase/admin')
  const db = createAdminClient()

  const members: M[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('members')
      .select('id, first_name, last_name, cedula, cedula_normalized, email, phone, birth_date, external_id, auth_user_id, account_confirmed_at, is_active, is_system, created_at, sede_id, photo_url')
      .order('id').range(from, from + 999)
    if (error) throw error
    const page = (data ?? []) as M[]
    members.push(...page)
    if (page.length < 1000) break
  }
  const vivos = members.filter(m => !m.is_system)
  const nombre = (m: M) => `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()

  // ── Agrupar por cada señal ────────────────────────────────────────────────
  const grupos = new Map<string, { señal: string; ms: M[] }>()
  const agrupar = (señal: string, clave: (m: M) => string | null) => {
    const idx = new Map<string, M[]>()
    for (const m of vivos) {
      const k = clave(m)
      if (!k) continue
      idx.set(k, [...(idx.get(k) ?? []), m])
    }
    for (const [k, ms] of idx) {
      if (ms.length < 2) continue
      // Clave estable del par/grupo: los ids ordenados. Así el mismo grupo
      // detectado por dos señales no se cuenta dos veces.
      const id = ms.map(m => m.id).sort().join('|')
      const previo = grupos.get(id)
      if (previo) previo.señal += ` + ${señal}`
      else grupos.set(id, { señal, ms })
      void k
    }
  }

  agrupar('misma cédula', m => (m.cedula_normalized ?? '').trim().toUpperCase() || null)
  agrupar('mismo correo', m => (m.email ?? '').trim().toLowerCase() || null)
  agrupar('nombre + nacimiento', m => (nombre(m) && m.birth_date) ? `${norm(nombre(m))}|${m.birth_date}` : null)
  agrupar('nombre + teléfono', m => {
    const tel = (m.phone ?? '').replace(/\D/g, '')
    return (nombre(m) && tel.length >= 8) ? `${norm(nombre(m))}|${tel}` : null
  })

  // ── Clasificar cada grupo ─────────────────────────────────────────────────
  type Fila = {
    grupo: number; señal: string; veredicto: string
    conservar: M; duplicado: M; otros: M[]
  }
  const filas: Fila[] = []
  let n = 0
  for (const { señal, ms } of [...grupos.values()].sort((a, b) => a.ms[0].id.localeCompare(b.ms[0].id))) {
    n++
    // Cuál conservar: la que tenga cuenta activada, luego cuenta, luego cédula,
    // luego más datos llenos, luego la más antigua.
    const puntaje = (m: M) =>
      (m.account_confirmed_at ? 1000 : 0) + (m.auth_user_id ? 500 : 0) + (m.cedula ? 100 : 0) +
      (m.email ? 20 : 0) + (m.phone ? 10 : 0) + (m.birth_date ? 5 : 0) + (m.sede_id ? 3 : 0) + (m.photo_url ? 2 : 0)
    const orden = [...ms].sort((a, b) => puntaje(b) - puntaje(a) || (a.created_at < b.created_at ? -1 : 1))
    const [conservar, duplicado, ...otros] = orden

    // El nombre igual (tras normalizar) es lo que separa "misma persona" de
    // "familiares que comparten el correo".
    const mismoNombre = new Set(ms.map(m => norm(nombre(m)))).size === 1
    const porCedula = señal.includes('cédula')
    const veredicto = porCedula
      ? 'MISMA PERSONA (misma cédula)'
      : mismoNombre
        ? 'MISMA PERSONA (mismo nombre)'
        : señal.includes('correo') && !mismoNombre
          ? 'REVISAR: nombres distintos, puede ser familia con un correo compartido'
          : 'REVISAR'
    filas.push({ grupo: n, señal, veredicto, conservar, duplicado, otros })
  }

  // ── Salida ────────────────────────────────────────────────────────────────
  const L = (s = '') => console.log(s)
  const seguros = filas.filter(f => f.veredicto.startsWith('MISMA PERSONA'))
  const revisar = filas.filter(f => !f.veredicto.startsWith('MISMA PERSONA'))
  L(`Padrón: ${members.length} fichas (${members.length - vivos.length} del sistema, excluidas)`)
  L()
  L(`Grupos duplicados encontrados : ${filas.length}`)
  L(`  Misma persona (para merge)  : ${seguros.length}`)
  L(`  A revisar a mano            : ${revisar.length}`)
  L()

  const detalle = (f: Fila) => {
    const info = (m: M, tag: string) => {
      const cuenta = m.account_confirmed_at ? 'cuenta ACTIVADA' : m.auth_user_id ? 'cuenta sin activar' : 'sin cuenta'
      L(`   ${tag} ${nombre(m)}  (CCB ${m.external_id ?? '—'})`)
      L(`       ${m.id}`)
      L(`       céd ${m.cedula ?? '—'} · ${m.email ?? 'sin correo'} · tel ${m.phone ?? '—'} · nac ${m.birth_date ?? '—'} · ${cuenta} · creada ${m.created_at.slice(0, 10)}`)
    }
    L(`── #${f.grupo}  ${f.veredicto}   [${f.señal}]`)
    info(f.conservar, 'CONSERVAR ')
    info(f.duplicado, 'DUPLICADA ')
    for (const o of f.otros) info(o, 'DUPLICADA ')
    L(`   SELECT merge_members('${f.conservar.id}', '${f.duplicado.id}');`)
    for (const o of f.otros) L(`   SELECT merge_members('${f.conservar.id}', '${o.id}');`)
    L()
  }

  L('════════ MISMA PERSONA — listas para fusionar ════════')
  L()
  for (const f of seguros) detalle(f)
  if (revisar.length) {
    L('════════ A REVISAR A MANO ════════')
    L()
    for (const f of revisar) detalle(f)
  }

  const cabecera = [
    'grupo', 'veredicto', 'senal', 'accion',
    'nombre', 'ccb_id', 'member_id', 'cedula', 'email', 'telefono', 'nacimiento',
    'cuenta', 'creada', 'sql_merge',
  ]
  const lineas: string[] = []
  for (const f of filas) {
    const filaDe = (m: M, accion: string, sql: string) => [
      f.grupo, f.veredicto, f.señal, accion,
      `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(), m.external_id ?? '', m.id,
      m.cedula ?? '', m.email ?? '', m.phone ?? '', m.birth_date ?? '',
      m.account_confirmed_at ? 'activada' : m.auth_user_id ? 'sin activar' : 'sin cuenta',
      m.created_at.slice(0, 10), sql,
    ].map(csvCell).join(',')
    lineas.push(filaDe(f.conservar, 'CONSERVAR', ''))
    lineas.push(filaDe(f.duplicado, 'DUPLICADA', `SELECT merge_members('${f.conservar.id}', '${f.duplicado.id}');`))
    for (const o of f.otros) {
      lineas.push(filaDe(o, 'DUPLICADA', `SELECT merge_members('${f.conservar.id}', '${o.id}');`))
    }
  }
  writeFileSync(OUT, '﻿' + [cabecera.map(csvCell).join(','), ...lineas].join('\n'), 'utf8')
  L(`CSV escrito: ${OUT}  (${lineas.length} filas)`)
  L()
  L('Para fusionar, corriendo el SQL de la columna sql_merge. Conserva la ficha')
  L('marcada CONSERVAR: es la que tiene la cuenta de acceso y el historial.')
}

main().catch(e => { console.error(e); process.exit(1) })
