// Parser de frontmatter para el centro de ayuda. Subconjunto de YAML a propósito
// (sin dependencias): strings, números, booleanos y listas en línea `[a, b]` o
// con guiones. Suficiente para los campos del contenido de /ayuda y sin traer
// un parser completo al bundle del servidor.

export type FrontmatterValue = string | number | boolean | string[]

export type ParsedFile = {
  data: Record<string, FrontmatterValue>
  /** El cuerpo Markdown, sin el bloque de frontmatter. */
  content: string
}

const unquote = (s: string) => s.replace(/^['"]|['"]$/g, '').trim()

function parseScalar(raw: string): FrontmatterValue {
  const v = raw.trim()
  if (v.startsWith('[') && v.endsWith(']')) {
    return v.slice(1, -1).split(',').map(unquote).filter(Boolean)
  }
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (v === 'true') return true
  if (v === 'false') return false
  return unquote(v)
}

/** Separa el frontmatter (--- ... ---) del cuerpo. Sin frontmatter → data vacía
 *  y el archivo completo como contenido. */
export function parseFrontmatter(file: string): ParsedFile {
  const text = file.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) return { data: {}, content: text.trim() }

  const data: Record<string, FrontmatterValue> = {}
  let currentListKey: string | null = null

  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue

    // Ítem de lista con guiones, que continúa la clave anterior.
    const listItem = /^\s*-\s+(.*)$/.exec(line)
    if (listItem && currentListKey) {
      const cur = data[currentListKey]
      const item = unquote(listItem[1])
      data[currentListKey] = Array.isArray(cur) ? [...cur, item] : [item]
      continue
    }

    const kv = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line)
    if (!kv) continue
    const [, key, rawValue] = kv
    if (rawValue.trim() === '') {
      // `clave:` sola → los guiones de abajo son su lista.
      currentListKey = key
      data[key] = []
      continue
    }
    currentListKey = null
    data[key] = parseScalar(rawValue)
  }

  return { data, content: text.slice(match[0].length).trim() }
}
