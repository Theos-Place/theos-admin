import { describe, it, expect } from 'vitest'
import {
  camposDelFormulario, restriccionSoloDirigentes, SI_QUIERE_CAPACITARSE,
  TITULO_DEL_FORMULARIO,
} from './formulario-de-disponibilidad'
import { normalizeRestriction, restrictionSummary } from '@/lib/audiencia/restriccion'
import { campoVisible } from '@/lib/forms/logica-condicional'
import type { FormFieldNew, LogicRule } from '@/types/forms'

const IDS = {
  intro: 'i', disponibilidad: 'd', quiereCapacitarse: 'q',
  cualesEstudios: 'c', comentarios: 'x',
}
const PLANES = [
  { code: 'N1', name: 'Nivel 1' }, { code: 'N2', name: 'Nivel 2' },
  { code: 'DIS1', name: 'Discípulos 1' }, { code: 'PREMAT', name: 'Prematrimonial' },
]
const CAMPOS = camposDelFormulario(IDS, () => 'x', PLANES)
const por = (id: string) => CAMPOS.find(c => c.id === id)!

describe('el formulario espejo', () => {
  it('lleva el bloque que escribe en la ficha, no una copia de las preguntas', () => {
    // Si las preguntas se re-escribieran acá como campos normales, lo
    // contestado quedaría en respuestas y alguien tendría que transcribirlo,
    // que es justo lo que esto viene a matar.
    expect(por(IDS.disponibilidad).field_type).toBe('leader_availability')
  })

  it('ese bloque NO puede ser obligatorio', () => {
    // No guarda respuesta: exigirlo bloquearía el envío para siempre.
    expect(por(IDS.disponibilidad).is_required).toBeFalsy()
  })

  it('«cuáles te interesan» solo aparece si dijo que sí', () => {
    // La columna `conditions` de la base es LITERALMENTE lo que el adapter
    // pone en `logic_rules` (`toLogicRules` solo comprueba que sea un array).
    // Se evalúa con el MISMO motor que la pantalla: probar la condición a mano
    // habría dado verde con una forma que la app no entiende.
    const campo: Pick<FormFieldNew, 'logic_rules'> = {
      logic_rules: por(IDS.cualesEstudios).conditions as unknown as LogicRule[],
    }
    const visible = (respuesta: string) =>
      campoVisible(campo, { [IDS.quiereCapacitarse]: respuesta } as never)
    expect(visible(SI_QUIERE_CAPACITARSE)).toBe(true)
    expect(visible('No')).toBe(false)
    expect(visible('')).toBe(false)
  })

  it('dice en voz alta que NO cambia la capacitación', () => {
    // Es la confusión que el módulo entero existe para evitar: capacitado lo
    // certifica el comité, disponible lo dice la persona.
    const textos = CAMPOS.map(c => `${c.label} ${c.description ?? ''}`).join(' ')
    expect(textos).toMatch(/no cambia los estudios para los que estás capacitado/i)
    expect(textos).toMatch(/no te asigna ningún grupo/i)
  })
})

describe('«¿cuáles te interesan?» es una lista, no un campo abierto', () => {
  it('es multiselección y trae opciones del catálogo', () => {
    // Escrito a mano, cada persona lo nombra distinto —«niveles», «Nivel 3»,
    // «los niveles»— y la lista de a quién convocar hay que armarla leyendo
    // respuesta por respuesta, que es el trabajo que esto viene a quitar.
    const c = por(IDS.cualesEstudios)
    expect(c.field_type).toBe('multiselect')
    expect(c.options?.length).toBeGreaterThan(0)
  })

  it('agrupa igual que la pantalla de dirigentes: «Niveles», no N1 y N2 sueltos', () => {
    const opciones = por(IDS.cualesEstudios).options ?? []
    expect(opciones).toContain('Niveles')
    expect(opciones).toContain('Discípulos')
    expect(opciones).not.toContain('N1 — Nivel 1')
    expect(opciones).toContain('PREMAT — Prematrimonial')
  })

  it('las opciones salen del catálogo que se le pase, no de una lista fija', () => {
    // Si estuvieran escritas en el código, el día que se agregue un estudio la
    // pregunta seguiría ofreciendo los de antes y nadie lo notaría.
    const conUno = camposDelFormulario(IDS, () => 'x', [{ code: 'HER', name: 'Herramientas' }])
    expect(conUno.find(c => c.id === IDS.cualesEstudios)!.options)
      .toEqual(['Niveles', 'Discípulos', 'HER — Herramientas'])
  })
})

describe('la audiencia', () => {
  it('es una restricción VÁLIDA: si no, se descarta en silencio y queda abierto', () => {
    // `normalizeRestriction` devuelve null ante cualquier cosa que no tenga
    // forma de condición permitida — y null significa «sin restricción», o sea
    // abierto a todo el mundo. Es el peor final posible para este formulario.
    const r = normalizeRestriction(restriccionSoloDirigentes())
    expect(r).not.toBeNull()
    expect(r!.conditions).toHaveLength(1)
  })

  it('y dice «Dirigente», que es lo que se lee en la pantalla', () => {
    expect(restrictionSummary(normalizeRestriction(restriccionSoloDirigentes()))).toBe('Dirigente')
  })

  it('el título es el que usa el seed para ser idempotente', () => {
    expect(TITULO_DEL_FORMULARIO.trim()).toBe(TITULO_DEL_FORMULARIO)
    expect(TITULO_DEL_FORMULARIO.length).toBeGreaterThan(5)
  })
})
