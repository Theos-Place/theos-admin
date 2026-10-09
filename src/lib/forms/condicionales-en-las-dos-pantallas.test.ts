import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * LAS DOS PANTALLAS QUE LLENAN FORMULARIOS TIENEN QUE RESPETAR LAS MISMAS
 * REGLAS.
 *
 * EL BUG (Floriana, 2026-10-08): «no me está respetando las reglas; en el
 * preview sirve, pero cuando lo abro no». Tenía razón en las dos mitades.
 * El preview y la página con sesión usan `FormFiller`, que llama a
 * `campoVisible`. La página PÚBLICA usa `PublicFormFiller`, que no sabía que
 * las reglas existían: dibujaba todos los campos siempre.
 *
 * En «Matrimonios - Octubre 2026» eso mostraba «¿Cómo se llama tu pareja?» y
 * «¿Tu pareja tiene restricción alimenticia?» antes de contestar si la pareja
 * iba — y como los dos son OBLIGATORIOS, quien contestaba «No» no podía
 * enviar: la validación le exigía campos que no le aplican.
 *
 * Son dos componentes a propósito (el público no tiene sesión, perfil ni
 * borradores). Lo que NO puede pasar es que decidan distinto qué se ve.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const PANTALLAS = {
  'con sesión y preview': 'src/components/forms/FormFiller.tsx',
  'pública': 'src/components/forms/PublicFormFiller.tsx',
}

describe('las reglas condicionales valen en las dos pantallas', () => {
  for (const [nombre, ruta] of Object.entries(PANTALLAS)) {
    it(`la ${nombre} usa campoVisible, no su propio criterio`, () => {
      const src = sinComentarios(ruta)
      expect(src).toContain("from '@/lib/forms/logica-condicional'")
      expect(src).toContain('campoVisible')
    })

    it(`la ${nombre} no manda las respuestas de los campos ocultos`, () => {
      // Marcar Sí, escribir, arrepentirse y marcar No dejaba el dato viejo
      // viajando al servidor.
      expect(sinComentarios(ruta)).toContain('respuestasVisibles(')
    })
  }

  it('la pública exige SOLO los obligatorios que están a la vista', () => {
    /**
     * Es la mitad que dejaba el formulario sin salida: con los ocultos en la
     * cuenta, quien contesta «No» ve «Falta contestar: ¿Cómo se llama tu
     * pareja?» por un campo que no puede ni ver.
     */
    const src = sinComentarios('src/components/forms/PublicFormFiller.tsx')
    expect(src).toContain('const visibles = delFormulario.filter(esVisible)')
    expect(src).toMatch(/const sinContestar = visibles\.filter/)
  })

  it('y la pública recibe las condiciones del API: sin eso no hay nada que evaluar', () => {
    const api = sinComentarios('src/app/api/public/forms/[id]/route.ts')
    expect(api).toContain('conditions')
  })

  it('ninguna de las dos reimplementa la regla', () => {
    // Copiarla arregla hoy y abre la próxima diferencia entre pantallas.
    for (const ruta of Object.values(PANTALLAS)) {
      const src = sinComentarios(ruta)
      expect(src, ruta).not.toContain("=== 'show'")
      expect(src, ruta).not.toContain("condition_operator ===")
    }
  })
})
