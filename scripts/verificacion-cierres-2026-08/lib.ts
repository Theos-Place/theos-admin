/**
 * Verificación de cierres · match de personas y dirigentes contra la base.
 *
 * El parseo del formulario vive en src/lib/studies/ccb-form-parse.ts (puro y
 * con tests). Acá va lo que necesita la base: resolver un nombre suelto a un
 * miembro, con score y marcando todo lo dudoso.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { norm } from '../../src/lib/studies/ccb-form-parse'
import { leerCsv } from '../ccb-migracion-2026-08/lib'

export function cargarEnv(): void {
  for (const f of ['.env', '.env.local']) {
    try {
      for (const l of readFileSync(join(process.cwd(), f), 'utf8').split('\n')) {
        const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    } catch { /* sigue */ }
  }
}

/**
 * Las respuestas de LOS DOS formularios juntas.
 *
 * Son dos formularios distintos en CCB —"EB · Fin de Capacitación" y "EB · Fin
 * de Nivel 4"— con las mismas columnas. Se leen juntos porque los cruces son
 * los mismos: el segundo trae los Niveles, que el primero no cubre y que son la
 * mitad de las matrículas colgadas.
 *
 * `_form` queda en cada fila para poder decir de cuál vino cada hallazgo.
 */
export function leerFormularios(): Array<Record<string, string> & { _form: 'capacitacion' | 'nivel4' }> {
  const cap = leerCsv('ccb-form-fin-capacitacion.csv').map(r => ({ ...r, _form: 'capacitacion' as const }))
  let niv: Array<Record<string, string> & { _form: 'nivel4' }> = []
  try {
    niv = leerCsv('ccb-form-fin-nivel4.csv').map(r => ({ ...r, _form: 'nivel4' as const }))
  } catch { /* el CSV lo genera convertir-nivel4.ts; si no está, se sigue con uno */ }
  return [...cap, ...niv]
}

export type Miembro = { id: string; external_id: string | null; first_name: string; last_name: string }

export type Match = {
  /** null = no se encontró a nadie. */
  miembro: Miembro | null
  /** 1.00 exacto · 0.90 todos los tokens · 0.75 nombre + primer apellido. */
  score: number
  /** Por qué se eligió, para poder discutirlo caso por caso. */
  motivo: string
  /** Varios candidatos con el mismo score: NO se elige, se reporta. */
  ambiguo: Miembro[]
}

const NADIE: Match = { miembro: null, score: 0, motivo: 'sin match', ambiguo: [] }

/** Índice de miembros por las formas en que se los puede nombrar. */
export class IndiceMiembros {
  private exacto = new Map<string, Miembro[]>()
  private porToken = new Map<string, Miembro[]>()

  constructor(private miembros: Miembro[]) {
    for (const m of miembros) {
      const completo = norm(`${m.first_name} ${m.last_name}`)
      this.push(this.exacto, completo, m)
      for (const t of completo.split(' ')) if (t.length > 2) this.push(this.porToken, t, m)
    }
  }

  private push(map: Map<string, Miembro[]>, k: string, m: Miembro) {
    map.set(k, [...(map.get(k) ?? []), m])
  }

  /**
   * Resuelve UNA lectura del nombre.
   *
   * Tres niveles, de más a menos seguro, y ninguno adivina: si en un nivel hay
   * más de un candidato, se devuelve `ambiguo` con todos y `miembro` en null.
   * Es la misma decisión que tomó la migración de junio — un umbral de
   * similitud sobre 23.700 personas produce matches equivocados que después
   * nadie encuentra.
   */
  buscar(nombre: string): Match {
    const n = norm(nombre)
    if (!n) return NADIE

    const ex = this.exacto.get(n) ?? []
    if (ex.length === 1) return { miembro: ex[0], score: 1, motivo: 'nombre completo exacto', ambiguo: [] }
    if (ex.length > 1) return { miembro: null, score: 1, motivo: 'exacto pero homónimos', ambiguo: ex }

    const tokens = n.split(' ').filter(t => t.length > 2)
    if (tokens.length < 2) return NADIE

    // Todos los tokens del CSV presentes en el nombre del miembro.
    const cuenta = new Map<string, number>()
    for (const t of tokens) for (const m of this.porToken.get(t) ?? []) {
      cuenta.set(m.id, (cuenta.get(m.id) ?? 0) + 1)
    }
    const porId = new Map(this.miembros.map(m => [m.id, m]))
    const todos = [...cuenta.entries()].filter(([, c]) => c === tokens.length).map(([id]) => porId.get(id)!)
    if (todos.length === 1) return { miembro: todos[0], score: 0.9, motivo: 'todos los tokens del nombre', ambiguo: [] }
    if (todos.length > 1) return { miembro: null, score: 0.9, motivo: 'varios con todos los tokens', ambiguo: todos }

    // Primer nombre + primer apellido (el patrón de "Gloriana Fallas").
    const [pn, pa] = [tokens[0], tokens[1]]
    const par = (this.porToken.get(pn) ?? []).filter(m => {
      const t = norm(`${m.first_name} ${m.last_name}`).split(' ')
      return t[0] === pn && t.slice(1).includes(pa)
    })
    if (par.length === 1) return { miembro: par[0], score: 0.75, motivo: 'nombre + primer apellido', ambiguo: [] }
    if (par.length > 1) return { miembro: null, score: 0.75, motivo: 'varios con nombre + primer apellido', ambiguo: par }
    return NADIE
  }

  /**
   * Match contra una lista CHICA y conocida (los matriculados de un grupo).
   *
   * Acá sí vale el nombre de pila solo: "Laura" es inmatcheable contra 23.700
   * personas, pero contra las diez de un grupo es inequívoco. Si dos personas
   * del grupo comparten el nombre, no se elige — se devuelve ambiguo.
   */
  static enRoster(nombre: string, roster: Miembro[]): Match {
    const n = norm(nombre)
    if (!n) return NADIE
    const tokens = n.split(' ').filter(Boolean)
    const nom = (m: Miembro) => norm(`${m.first_name} ${m.last_name}`).split(' ')
    const niveles: Array<[number, string, (m: Miembro) => boolean]> = [
      [1, 'nombre completo exacto', m => nom(m).join(' ') === n],
      [0.95, 'todos los tokens contra la lista del grupo', m => tokens.every(t => nom(m).includes(t))],
      [0.85, 'nombre de pila contra la lista del grupo', m => tokens.length === 1 && nom(m)[0] === tokens[0]],
    ]
    for (const [score, motivo, test] of niveles) {
      const hit = roster.filter(test)
      if (hit.length === 1) return { miembro: hit[0], score, motivo, ambiguo: [] }
      if (hit.length > 1) return { miembro: null, score, motivo: `${motivo} (varios)`, ambiguo: hit }
    }
    return NADIE
  }

  /**
   * Resuelve las lecturas posibles de una línea (ver PersonaCruda.variantes).
   * Gana la de mejor score; si dos lecturas distintas dan personas distintas
   * con el mismo score, es ambigua y no se elige.
   */
  buscarVariantes(variantes: string[]): Match {
    const rs = variantes.map(v => this.buscar(v)).filter(r => r.miembro || r.ambiguo.length)
    if (rs.length === 0) return NADIE
    const mejor = rs.reduce((a, b) => (b.score > a.score ? b : a))
    const empatan = rs.filter(r => r.score === mejor.score && r.miembro && r.miembro.id !== mejor.miembro?.id)
    if (empatan.length) {
      return { miembro: null, score: mejor.score, motivo: 'dos lecturas del nombre dan personas distintas',
        ambiguo: [mejor.miembro!, ...empatan.map(r => r.miembro!)] }
    }
    return mejor
  }
}

/** Paginado: PostgREST corta en 1000 filas sin avisar. */
export async function todo<T>(
  admin: { from: (t: string) => { select: (s: string) => { range: (a: number, b: number) => { order: (c: string) => Promise<{ data: T[] | null; error: { message: string } | null }> } } } },
  tabla: string, select: string,
): Promise<T[]> {
  const out: T[] = []
  for (let d = 0; ; d += 1000) {
    const { data, error } = await admin.from(tabla).select(select).range(d, d + 999).order('id')
    if (error) throw new Error(`${tabla}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}
