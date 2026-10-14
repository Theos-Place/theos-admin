/**
 * DIR-13 · Importar el CSV de estados y formación de dirigentes de Fabiola.
 *
 * Las REGLAS no viven acá: están en `lib/leaders/import-csv-fabiola.ts`,
 * puro y con 17 tests. Este script lee, resuelve a quién corresponde cada
 * fila, aplica y reporta.
 *
 *   node --conditions=react-server npx tsx --env-file=.env.local \
 *     scripts/dir13-2026-10-13/importar.ts            # dry run
 *   … --aplicar                                        # escribe
 *
 * IDEMPOTENTE: la segunda corrida no encuentra nada que cambiar.
 */
import { readFileSync } from 'node:fs'
import { createAdminClient } from '@/lib/supabase/admin'
import { decidir, siONo, type FilaDelCsv } from '@/lib/leaders/import-csv-fabiola'

const CSV = 'data-import/dirigentes-status-fabiola-2026-10-13.csv'
const APLICAR = process.argv.includes('--aplicar')

/**
 * Los que Floriana resolvió A MANO, uno por uno, mirando cada caso.
 *
 * Los demás sin Individual ID quedaron FUERA a propósito:
 *  · «Solis, Adriana» — cuatro candidatas, ninguna es dirigente hoy y la
 *    fila del CSV viene sin teléfono ni correo. Decisión de Floriana el
 *    13-oct: «no sabemos quién, mejor no meterla».
 *  · Una fila sin nombre.
 */
const RESUELTOS_A_MANO: Record<string, string> = {
  'Chaves Duarte, Ariana': 'Ariana Chaves Duarte',
  'Ulloa, Mariliana': 'Mariliana Ulloa Solorzano',
  'Aguilar Berrocal, Carolina': 'Carolina Aguilar Berrocal',
  'Quesada, Juan': 'Juan Manuel Quesada Arroyo',
  'Guerra, Victor': 'Victor Guerra Araya',
  'Fernandez, Andres': 'Andres Fernandez Alvarado',
  'Santana, Andres': 'Andres Santana Mora',
  'Badilla, Fiorella': 'Fiorella Badilla Peralta',
  'Piedra, Victoria': 'Ana Victoria Piedra',
  'Fonseca, Desiree': 'Desiree Fonseca',
  'Sasso, Dylia': 'Dylia Sasso',
  'Lizano, Adriana': 'Adriana Lizano',
  'Gurdian, Andrés': 'Andres Gurdian Arango',
}

/** Las columnas de formación del CSV → código de estudio. */
const FORMACION: Record<string, string[]> = {
  'Quieren dar Niveles': ['N1', 'N2', 'N3', 'N4'],
  'Pre-Matrimonial': ['PREMAT'],
  SCJ: ['SCJ'], ASF: ['ASF'], EVM: ['EVM'], AED: ['AED'], MAT: ['MAT'],
  Dis: ['DIS1', 'DIS2', 'DIS3'], CTBD: ['CTBD'], PAM: ['PAN'], EVA: ['EVA'],
  HCH: ['HCH'], ROM: ['ROM'], HEB: ['HEB'], RDM: ['RDM'], DLF: ['DLF'],
}

type Fila = Record<string, string>

function parseCsv(texto: string): Fila[] {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim())
  const sep = (l: string): string[] => {
    const out: string[] = []; let cur = ''; let q = false
    for (const ch of l) {
      if (ch === '"') { q = !q; continue }
      if (ch === ',' && !q) { out.push(cur); cur = ''; continue }
      cur += ch
    }
    out.push(cur); return out
  }
  const cab = sep(lineas[0])
  return lineas.slice(1).map(l => Object.fromEntries(sep(l).map((v, i) => [cab[i], v])))
}

const norm = (s: string): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

async function main() {
  const sb = createAdminClient()
  const filas = parseCsv(readFileSync(CSV, 'latin1'))

  // Quién tiene grupo abierto: en curso o en matrícula, sin prematrimonial.
  const { data: grupos } = await sb
    .from('study_groups')
    .select('leader_id, co_leader_id, study_plans!inner(code)')
    .in('status', ['en_curso', 'en_matricula'])
  const dirigiendo = new Set<string>()
  for (const g of (grupos ?? []) as unknown as Array<{
    leader_id: string | null; co_leader_id: string | null
    study_plans: { code: string | null } | null
  }>) {
    if (g.study_plans?.code === 'PREMAT') continue
    if (g.leader_id) dirigiendo.add(g.leader_id)
    if (g.co_leader_id) dirigiendo.add(g.co_leader_id)
  }

  // Fichas de dirigente de hoy.
  const { data: fichas } = await sb
    .from('study_leaders')
    .select('member_id, estado_base, formation_study_codes, en_grupo_whatsapp')
  const porMiembro = new Map((((fichas ?? []) as unknown) as Array<{
    member_id: string; estado_base: string | null
    formation_study_codes: string[] | null; en_grupo_whatsapp: boolean | null
  }>).map(f => [f.member_id, f]))

  /**
   * Los 13 resueltos a mano, buscados POR SU NOMBRE EXACTO.
   *
   * NO se trae el padrón entero para buscar dentro: son ~18.000 miembros y
   * PostgREST corta en 1.000 sin avisar, así que los buscados simplemente
   * no aparecían y caían todos a «sin resolver». Es el mismo corte que
   * esta misma noche dejó 82 check-ins fuera de la pantalla de Meridiano.
   */
  const porNombre = new Map<string, string>()
  for (const nombreCompleto of new Set(Object.values(RESUELTOS_A_MANO))) {
    const [primero, ...resto] = nombreCompleto.split(' ')
    const { data: cands } = await sb
      .from('members').select('id, first_name, last_name')
      .eq('is_active', true).ilike('first_name', `${primero}%`)
    const match = ((cands ?? []) as Array<{ id: string; first_name: string; last_name: string }>)
      .filter(m => norm(`${m.first_name} ${m.last_name}`) === norm(nombreCompleto))
    // Si hay dos con el nombre idéntico, NO se elige: se reporta. La regla
    // de AGENTS.md, aprendida confundiendo a dos personas distintas.
    if (match.length === 1) porNombre.set(norm(nombreCompleto), match[0].id)
    else console.warn(`  ⚠ «${nombreCompleto}»: ${match.length} coincidencias, se omite`)
    void resto
  }

  const resumen: Record<string, number> = {}
  const sinResolver: string[] = []
  const aplicadas: Array<{ nombre: string; cambio: string }> = []
  let formacionAgregada = 0
  let whatsappMarcados = 0

  for (const f of filas) {
    const nombreCsv = (f['Nombre con coma'] ?? '').trim()
    const ext = (f['Individual ID'] ?? '').trim()

    // 1 · A quién corresponde: primero el ID (que resuelve fusiones), si
    //     no, la lista que Floriana revisó una por una.
    let memberId: string | null = null
    if (ext) {
      const { data } = await sb.rpc('member_por_external_id', { p_ext: ext })
      memberId = (data as string | null) ?? null
    }
    if (!memberId && RESUELTOS_A_MANO[nombreCsv]) {
      memberId = porNombre.get(norm(RESUELTOS_A_MANO[nombreCsv])) ?? null
    }
    if (!memberId) { sinResolver.push(nombreCsv || '(fila sin nombre)'); continue }

    const ficha = porMiembro.get(memberId)
    const entrada: FilaDelCsv = {
      individualId: ext || null, nombre: nombreCsv,
      status: f.Status ?? '', disponibilidad: f.Disponibilidad ?? '',
      enGrupoWhatsapp: siONo(f['Están en el grupo de whatsapp']),
    }
    const d = decidir(entrada, {
      dirigiendo: dirigiendo.has(memberId),
      estadoBase: (ficha?.estado_base as 'activo' | 'inactivo' | null) ?? null,
    })

    const clave = d.tipo === 'aplicar'
      ? `${d.cambios.estado_base}${d.cambios.razon_no_disponible ? ' · ' + d.cambios.razon_no_disponible : ''}`
        + (d.cambios.revision.length ? ' + banderita' : '')
      : `${d.tipo}: ${d.motivo}`
    resumen[clave] = (resumen[clave] ?? 0) + 1
    if (d.tipo !== 'aplicar') continue

    // 2 · FORMACIÓN, SOLO ADITIVA. Las columnas en FALSO no niegan nada:
    //     el CSV casi no las usó, y quitar formación por un vacío borraría
    //     certificaciones que el comité sí dio.
    const tiene = new Set(ficha?.formation_study_codes ?? [])
    const antes = tiene.size
    for (const [col, codes] of Object.entries(FORMACION)) {
      if (!siONo(f[col])) continue
      for (const code of codes) tiene.add(code)
    }
    const sumaFormacion = tiene.size > antes
    if (sumaFormacion) formacionAgregada++

    const wa = entrada.enGrupoWhatsapp
    if (wa && !ficha?.en_grupo_whatsapp) whatsappMarcados++

    aplicadas.push({ nombre: nombreCsv, cambio: clave })

    if (!APLICAR) continue

    const patch: Record<string, unknown> = {
      estado_base: d.cambios.estado_base,
      razon_inactivo: d.cambios.razon_inactivo,
      disponibilidad: d.cambios.disponibilidad,
      razon_no_disponible: d.cambios.razon_no_disponible,
      revision: d.cambios.revision,
      is_active: d.cambios.estado_base === 'activo',
      formation_study_codes: [...tiene].sort(),
    }
    // El WhatsApp solo se PRENDE: un FALSO del CSV no saca del grupo a
    // quien alguien marcó a mano acá.
    if (wa) patch.en_grupo_whatsapp = true
    // La pausa sin fecha queda dicha en su nota, para que Fabiola la vea.
    if (d.cambios.pausa_por_completar) {
      patch.nota_pausa = 'Pausa importada del CSV del 13-oct-2026: falta fecha de regreso y motivo.'
    }

    if (ficha) {
      const { error } = await sb.from('study_leaders')
        .update(patch as never).eq('member_id', memberId)
      if (error) console.error(`  ✗ ${nombreCsv}: ${error.message}`)
    } else {
      const { error } = await sb.from('study_leaders')
        .insert({ member_id: memberId, ...patch } as never)
      if (error) console.error(`  ✗ ${nombreCsv} (ficha nueva): ${error.message}`)
    }
  }

  console.log(`\n═══ DIR-13 · ${APLICAR ? 'APLICANDO' : 'DRY RUN'} ═══\n`)
  console.log('filas del CSV        :', filas.length)
  console.log('sin resolver         :', sinResolver.length)
  console.log('se aplican           :', aplicadas.length)
  console.log('suman formación      :', formacionAgregada)
  console.log('se marcan en WhatsApp:', whatsappMarcados)
  console.log('\n--- por tipo ---')
  for (const [k, v] of Object.entries(resumen).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`)
  }
  if (sinResolver.length) {
    console.log('\n--- sin resolver (quedan para Fabiola) ---')
    for (const s of sinResolver) console.log(`  ${s}`)
  }
  if (!APLICAR) console.log('\nCorrer con --aplicar para escribir.')
}

main().catch(e => { console.error('ERR:', e); process.exit(1) })
