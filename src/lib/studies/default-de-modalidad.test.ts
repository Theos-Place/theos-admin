import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { modalidadDe, MODALIDAD_POR_DEFECTO } from './modalidad-de-bloques'

/**
 * EST-14 · Un grupo NUEVO nace en el esquema nuevo («bloques»). El viejo se
 * elige a mano.
 *
 * Decisión de Floriana, 2026-10-13: los N1 que se crean de ahora en adelante
 * son del esquema nuevo por defecto, y solo si alguien lo cambia pasan a ser
 * del viejo.
 *
 * DÓNDE VIVE ESA DECISIÓN: en el DEFAULT DE LA COLUMNA
 * (`study_groups.modalidad default 'bloques'`), no en TypeScript. Por eso el
 * formulario de creación NO manda el campo — si lo mandara, pisaría el
 * default y habría dos lugares decidiendo lo mismo. Verificado contra
 * producción el 2026-10-13 con un insert y rollback: un N1 creado sin
 * especificar modalidad queda en `bloques`.
 *
 * OJO CON LA ASIMETRÍA, que es deliberada y conviene no «arreglarla»: el
 * default de la COLUMNA es `bloques` (lo que nace hoy) y el default de
 * `modalidadDe()` es `legacy` (cómo leer un dato que falta). No se
 * contradicen porque responden preguntas distintas. Equivocarse hacia
 * legacy al LEER genera un cobro y un folleto de más —visible y
 * corregible—; equivocarse hacia bloques deja a alguien sin folleto, que es
 * el error que nadie ve hasta que llega a clase sin material.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const FORM_NUEVO = sinComentarios('src/app/(admin)/estudios/grupos/nuevo/page.tsx')
const FICHA = sinComentarios('src/app/(admin)/estudios/grupos/[id]/page.tsx')

describe('un grupo nuevo nace en el esquema nuevo', () => {
  it('el formulario de creación NO manda modalidad: gana el default de la columna', () => {
    // Si algún día manda una, el default de la BD deja de mandar y esta
    // decisión pasa a estar escrita en dos lugares.
    expect(FORM_NUEVO).not.toContain('modalidad')
  })

  it('pero la ficha del grupo SÍ deja cambiarla a mano', () => {
    // «Solamente si se cambia, sería el esquema viejo».
    expect(FICHA).toContain('ModalidadDelGrupo')
  })

  it('y el control aparece solo en los niveles, donde las dos difieren', () => {
    expect(FICHA).toMatch(/\^N\[1-4\]\$/)
  })
})

describe('leer un dato ausente es otra pregunta que crear uno nuevo', () => {
  it('al LEER, lo desconocido se trata como legacy', () => {
    expect(MODALIDAD_POR_DEFECTO).toBe('legacy')
    expect(modalidadDe(null)).toBe('legacy')
    expect(modalidadDe(undefined)).toBe('legacy')
    expect(modalidadDe('cualquier cosa')).toBe('legacy')
  })

  it('y solo el valor exacto cuenta como bloques', () => {
    expect(modalidadDe('bloques')).toBe('bloques')
    expect(modalidadDe('Bloques')).toBe('legacy')
  })
})
