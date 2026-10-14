import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  esCampoDeFechaDeActividad, fechaDeActividadDeclarada, eventosDondeInscribir, esCampoDeFechaDePago,
  type CampoDelFormulario,
} from './pago-al-inscribirse'

const campo = (over: Partial<CampoDelFormulario>): CampoDelFormulario =>
  ({ id: 'c1', field_type: 'date', label: '', ...over } as CampoDelFormulario)

describe('el campo del día que eligió', () => {
  it('lo encuentra por la etiqueta real de los formularios de Sport', () => {
    expect(esCampoDeFechaDeActividad(campo({ label: 'Fecha del mes en la que se llevará acabo la actividad de mi interés' }))).toBe(true)
  })

  it('NO confunde la fecha de PAGO con la de la actividad', () => {
    // Confundirlas inscribiría a la gente el día que transfirió.
    const pago = campo({ label: 'Fecha en que se realizó el pago:' })
    expect(esCampoDeFechaDePago(pago)).toBe(true)
    expect(esCampoDeFechaDeActividad(pago)).toBe(false)
  })

  it('un campo que no es de fecha, no', () => {
    expect(esCampoDeFechaDeActividad(campo({ field_type: 'text', label: 'actividad' }))).toBe(false)
  })
})

describe('la fecha declarada', () => {
  const campos = [campo({ id: 'act', label: 'Fecha del mes de la actividad' }), campo({ id: 'pag', label: 'Fecha en que se realizó el pago' })]

  it('sale del campo de actividad, no del de pago', () => {
    expect(fechaDeActividadDeclarada(campos, [{ field_id: 'pag', value_text: '2026-10-01' }, { field_id: 'act', value_text: '2026-10-17' }])).toBe('2026-10-17')
  })

  it('vacía o basura → null', () => {
    expect(fechaDeActividadDeclarada(campos, [{ field_id: 'act', value_text: '  ' }])).toBeNull()
    expect(fechaDeActividadDeclarada(campos, [{ field_id: 'act', value_text: 'el sábado' }])).toBeNull()
    expect(fechaDeActividadDeclarada(campos, [])).toBeNull()
  })
})

describe('en cuál sesión se inscribe', () => {
  const sesiones = [
    { id: 'sep20', fechaLocal: '2026-09-20' },
    { id: 'oct17', fechaLocal: '2026-10-17' },
  ]

  it('un solo evento: ese, sin preguntar el día', () => {
    expect(eventosDondeInscribir([sesiones[0]], null)).toEqual({ ids: ['sep20'], motivo: 'unico' })
  })

  it('varios y el día coincide: SOLO ese', () => {
    // El caso de las 20 personas de Hiking: eligieron 17-oct y quedaban
    // también en Sports Day del 20-sep, con cobro.
    expect(eventosDondeInscribir(sesiones, '2026-10-17')).toEqual({ ids: ['oct17'], motivo: 'coincide' })
  })

  it('varios y SIN día: en ninguno, y se avisa', () => {
    expect(eventosDondeInscribir(sesiones, null)).toEqual({ ids: [], motivo: 'sin_dia' })
  })

  it('varios y un día que no es sesión: en NINGUNO, no «al más cercano»', () => {
    // Eduardo Bonilla escribió 2026-10-10. Adivinar el 17 es cómo habría
    // terminado cobrado igual.
    expect(eventosDondeInscribir(sesiones, '2026-10-10')).toEqual({ ids: [], motivo: 'sin_coincidencia' })
  })

  it('el cableado: linkResponseToRegistration pregunta a esta regla', () => {
    const src = readFileSync('src/lib/supabase/queries/forms.ts', 'utf8')
    expect(src).toContain('eventosDondeInscribir(candidatos, fechaDeActividad)')
    expect(src).toContain('fechaDeActividadDeclarada(listaCampos, respuestas)')
    // Y ya no inscribe en todos los ids del formulario a ciegas.
    expect(src).not.toMatch(/const ids = \(\(eventos \?\? \[\]\) as Array<\{ id: string \}>\)\.map\(e => e\.id\)/)
  })
})
