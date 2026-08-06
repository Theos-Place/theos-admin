// REU-2 · La reubicación tiene que ENCONTRARSE. El flujo ya existía; lo que
// faltaba era el acceso. Estos tests fijan que los accesos sigan puestos: son de
// código, porque la regla acá es "dónde está el botón", no un cálculo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveRequestSection } from './request-deeplink'

const leer = (p: string) => readFileSync(p, 'utf8')

const ENTRADAS: Array<{ archivo: string; donde: string }> = [
  { archivo: 'src/app/(admin)/matricula/confirmacion/page.tsx', donde: 'la confirmación de matrícula' },
  { archivo: 'src/app/(admin)/estudios/grupos/[id]/page.tsx', donde: 'la ficha del grupo del estudiante' },
  { archivo: 'src/app/(admin)/mis-pagos/page.tsx', donde: 'mis pagos' },
]

describe('dónde se puede pedir un cambio de grupo', () => {
  for (const { archivo, donde } of ENTRADAS) {
    it(`hay acceso en ${donde}`, () => {
      const src = leer(archivo)
      expect(src).toContain('StudyRequestActions')
      expect(src).toContain('only="relocation"')
      expect(src).toContain('variant="link"')
    })
  }

  it('el perfil sigue teniendo los dos botones de siempre', () => {
    const src = leer('src/app/(admin)/miembros/[id]/_components/MemberParticipationTab.tsx')
    expect(src).toContain('<StudyRequestActions memberId={memberId} />')
  })
})

describe('el modal explica qué pasa después', () => {
  const src = leer('src/components/studies/StudyRequestActions.tsx')

  it('dice que lo revisa un coordinador y que no es automático', () => {
    expect(src).toMatch(/coordinador de estudios/i)
    expect(src).toMatch(/no es autom[áa]tico/i)
  })

  it('dice que mientras tanto sigue en su grupo actual', () => {
    expect(src).toMatch(/segu[íi]s matriculado en tu grupo actual/i)
  })

  it('el enlace pregunta lo que la persona se está preguntando', () => {
    expect(src).toContain('¿Te matriculaste en el grupo equivocado?')
  })
})

describe('la cola del coordinador', () => {
  it('el módulo de estudios tiene su propia entrada a cambios de grupo', () => {
    const src = leer('src/app/(admin)/estudios/page.tsx')
    expect(src).toContain('tab=relocation')
    expect(src).toContain('Cambios de grupo')
    // Con contador propio: el conteo general mezcla intereses, que son
    // informativos y no hay que atender.
    expect(src).toContain('count=relocation')
  })

  it('el deep link ?tab=relocation abre esa sección', () => {
    expect(resolveRequestSection({ tabParam: 'relocation', requestId: null, fullQueue: true }))
      .toBe('relocation')
  })
})
