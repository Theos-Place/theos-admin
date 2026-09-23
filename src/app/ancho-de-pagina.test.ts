import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * QA-1/N2 · Ninguna pantalla del admin se fija el ancho a mano.
 *
 * LA REGLA (`Theos Place Design System/layout.md`, y AGENTS.md): hay TRES
 * anchos y ninguno se escribe a mano. El `AppShell` ya aplica `work` (1600px)
 * a todo el admin, así que una pantalla de gestión no envuelve nada; las de
 * lectura y las de formulario declaran el suyo con `<PageContainer>`.
 *
 * QUÉ ENCONTRÓ LA AUDITORÍA. Un solo `max-w` de página en todo el repo
 * (`miembros/listas/[id]`, `max-w-5xl`), que estrechaba una tabla a 1024 px
 * teniendo 1600 disponibles: 576 px menos antes de tener que arrastrar de lado.
 *
 * LO QUE **NO** CUENTA, y por eso este test mira solo la raíz de la página:
 * los `max-w-*` de un elemento INTERNO —un input, una tarjeta, un párrafo, una
 * pantalla de confirmación centrada— son otra cosa y se quedan. Lo dice la
 * regla y lo dice el comentario de `PageContainer`.
 */

// El `max-w` del elemento raíz que devuelve la página, que es el único que
// decide el ancho de la PANTALLA.
const RAIZ = /return \(\s*\n\s*(?:\/\/[^\n]*\n\s*)*<(?:div|main|section)\b[^>]*className=(?:"([^"]*)"|\{[^}]*\})/g
const MAXW = /(?<![\w-])max-w-[\w[\]./-]+/

/**
 * Exentas, cada una con su porqué. La regla las contempla: son estados
 * CENTRADOS que ocupan la pantalla entera, no pantallas de gestión.
 * Si alguien agrega una tercera, que escriba acá por qué.
 */
const EXENTAS: Record<string, string> = {
  'src/app/(admin)/matricula/confirmacion/page.tsx':
    'pantalla de confirmación centrada — la regla la exime por nombre',
  'src/app/(admin)/matricula/prematrimonial/page.tsx':
    'estado de error centrado; el ancho de la pantalla lo pone su <PageContainer width="form">',
}

const paginas = (dir: string): string[] =>
  readdirSync(dir).flatMap(n => {
    const ruta = join(dir, n)
    if (statSync(ruta).isDirectory()) return paginas(ruta)
    return n === 'page.tsx' ? [ruta] : []
  })

describe('ancho de página', () => {
  it('el admin no escribe max-w en la raíz de una pantalla', () => {
    const culpables: string[] = []
    for (const ruta of paginas('src/app/(admin)')) {
      if (ruta in EXENTAS) continue
      const src = readFileSync(ruta, 'utf8')
      for (const m of src.matchAll(RAIZ)) {
        const cls = m[1] ?? ''
        if (MAXW.test(cls)) culpables.push(`${ruta} → ${MAXW.exec(cls)![0]}`)
      }
    }
    expect(
      culpables,
      'El AppShell ya da el ancho. Si esta pantalla necesita otro, usá ' +
      '<PageContainer width="reading|form"> — no un max-w suelto.',
    ).toEqual([])
  })

  it('las exentas siguen existiendo — una lista que apunta a la nada no protege nada', () => {
    for (const ruta of Object.keys(EXENTAS)) {
      expect(() => readFileSync(ruta, 'utf8'), `${ruta} ya no existe: sacala de EXENTAS`).not.toThrow()
    }
  })
})
