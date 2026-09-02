/**
 * Guardia contra el embed ambiguo de PostgREST.
 *
 * Cuando una tabla tiene DOS o más llaves foráneas hacia la misma tabla,
 * `select('alias:destino(campo)')` no compila del lado de PostgREST: responde
 * PGRST201 y falla la consulta ENTERA, no solo el embed. La pantalla queda
 * vacía sin error visible.
 *
 * Pasó en producción el 2026-09-02: agregar `folleto_requests.origin_group_id`
 * (segunda llave hacia study_groups) dejó ciega la cola de folletos, porque un
 * `select` que ya existía embebía `study_groups(name)` sin hint. TypeScript no
 * lo pescó porque el resultado se castea a `Record<string, unknown>`, y el
 * error solo aparece contra la base real.
 *
 * El arreglo es nombrar la llave: `study_groups!folleto_requests_source_group_id_fkey(name)`.
 *
 * La lista de pares ambiguos vive en ambiguous-embeds.json y sale del esquema:
 *
 *   select src.relname origen, tgt.relname destino
 *   from pg_constraint con
 *     join pg_class src on src.oid = con.conrelid
 *     join pg_class tgt on tgt.oid = con.confrelid
 *     join pg_namespace n on n.oid = src.relnamespace
 *   where con.contype = 'f' and n.nspname = 'public'
 *   group by 1, 2 having count(*) > 1;
 *
 * Al agregar una llave foránea hacia una tabla que ya tenía otra, hay que
 * regenerar ese JSON — y este test dice de una qué consultas hay que arreglar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import ambiguos from './ambiguous-embeds.json'

const RAIZ = join(process.cwd(), 'src')

function archivosTs(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) archivosTs(p, acc)
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) acc.push(p)
  }
  return acc
}

/** Los `.from('tabla')` … `.select('…')` de un archivo, emparejados.
 *
 *  Se toma el PRIMER select después de cada from: es como está escrito todo el
 *  repo (cadena `.from().select()`, con saltos de línea en medio). Un select
 *  armado en una variable aparte se le escapa — el test no promete cobertura
 *  total, promete pescar el patrón normal. */
function consultas(codigo: string): Array<{ tabla: string; select: string; linea: number }> {
  const out: Array<{ tabla: string; select: string; linea: number }> = []
  const re = /\.from\(\s*'([a-z_]+)'\s*\)([\s\S]{0,80}?)\.select\(\s*(['"`])([\s\S]*?)\3/g
  let m: RegExpExecArray | null
  while ((m = re.exec(codigo)) !== null) {
    out.push({
      tabla: m[1],
      select: m[4],
      linea: codigo.slice(0, m.index).split('\n').length,
    })
  }
  return out
}

/** Los destinos que ese select embebe SIN nombrar la llave. */
function embedsSinHint(select: string, destinos: readonly string[]): string[] {
  const sucios: string[] = []
  for (const d of destinos) {
    // `destino(` o `alias:destino(` — pero no `destino!llave(`, que es el correcto.
    const re = new RegExp(`(?:^|[\\s,:(])${d}\\s*\\(`, 'g')
    if (re.test(select)) sucios.push(d)
  }
  return sucios
}

const MAPA = ambiguos as Record<string, string[]>

describe('embeds ambiguos de PostgREST', () => {
  it('ninguna consulta embebe una tabla con varias llaves sin nombrar la llave', () => {
    const problemas: string[] = []
    for (const archivo of archivosTs(RAIZ)) {
      const codigo = readFileSync(archivo, 'utf8')
      for (const q of consultas(codigo)) {
        const destinos = MAPA[q.tabla]
        if (!destinos) continue
        for (const d of embedsSinHint(q.select, destinos)) {
          problemas.push(
            `${archivo.replace(process.cwd() + '/', '')}:${q.linea} — `
            + `from('${q.tabla}') embebe '${d}' sin hint. `
            + `Hay más de una llave de ${q.tabla} a ${d}: usá ${d}!<nombre_de_la_llave>_fkey(...)`,
          )
        }
      }
    }
    expect(problemas).toEqual([])
  })

  it('la lista de pares ambiguos no está vacía (si lo está, el fixture se rompió)', () => {
    expect(Object.keys(MAPA).length).toBeGreaterThan(20)
    expect(MAPA.folleto_requests).toContain('study_groups')
  })
})

describe('el detector, sobre casos armados', () => {
  it('pesca el embed sin hint que rompió producción', () => {
    expect(embedsSinHint('id, source_group:study_groups(name)', ['study_groups'])).toEqual(['study_groups'])
  })

  it('acepta el embed con la llave nombrada', () => {
    expect(embedsSinHint(
      'id, source_group:study_groups!folleto_requests_source_group_id_fkey(name)',
      ['study_groups'],
    )).toEqual([])
  })

  it('no confunde una columna que termina igual que la tabla', () => {
    expect(embedsSinHint('id, total_members(x)', ['members'])).toEqual([])
  })

  it('empareja from y select aunque estén en líneas distintas', () => {
    const q = consultas(`
      const { data } = await supabase
        .from('folleto_requests')
        .select('id, source_group:study_groups(name)')
    `)
    expect(q).toHaveLength(1)
    expect(q[0].tabla).toBe('folleto_requests')
    expect(q[0].select).toContain('study_groups(name)')
  })
})
