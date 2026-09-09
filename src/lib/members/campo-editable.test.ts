import { describe, it, expect } from 'vitest'
import { editabilidadDeCampo } from './campo-editable'
import { PERSONAL_DATA_FIELDS } from '@/data/form-config'

const sinDoc = { tieneDocumento: false }
const conDoc = { tieneDocumento: true }

describe('qué se edita en sitio desde el formulario', () => {
  it('los datos de contacto, salud y trabajo sí', () => {
    for (const clave of ['phone', 'address', 'allergies', 'occupation', 'workplace']) {
      expect(editabilidadDeCampo(clave, conDoc).editable, clave).toBe(true)
    }
  })

  it('el correo NO, y sin cartel: no lleva lápiz y ya', () => {
    expect(editabilidadDeCampo('email', conDoc)).toEqual({ editable: false, motivo: null })
  })

  it('el género y la fecha de nacimiento SÍ; la edad no, porque es un cálculo', () => {
    expect(editabilidadDeCampo('gender', conDoc).editable).toBe(true)
    expect(editabilidadDeCampo('birth_date', conDoc).editable).toBe(true)
    // La edad sale de la fecha: se edita la fecha y se recalcula sola.
    expect(editabilidadDeCampo('age', conDoc).editable).toBe(false)
  })

  it('la cédula: se completa si falta, no se cambia si ya está', () => {
    expect(editabilidadDeCampo('cedula', sinDoc)).toEqual({ editable: true, columna: 'cedula', tipo: 'texto' })
    const conYa = editabilidadDeCampo('cedula', conDoc)
    expect(conYa.editable).toBe(false)
    expect(conYa.editable === false && conYa.motivo).toMatch(/pedilo en tu sede/)
  })

  it('el teléfono se marca como teléfono, y la dirección como párrafo', () => {
    const tel = editabilidadDeCampo('phone', conDoc)
    expect(tel.editable === true && tel.tipo).toBe('telefono')
    const dir = editabilidadDeCampo('address', conDoc)
    expect(dir.editable === true && dir.tipo).toBe('parrafo')
  })

  it('una clave desconocida no revienta ni se ofrece', () => {
    expect(editabilidadDeCampo('columna_inventada', conDoc)).toEqual({ editable: false, motivo: null })
  })

  it('todas las claves del catálogo tienen una respuesta', () => {
    // Si mañana alguien agrega un campo al catálogo, este test no falla — pero
    // deja constancia de cuáles quedan sin editar, que es la decisión.
    const noEditables = PERSONAL_DATA_FIELDS
      .filter(f => !editabilidadDeCampo(f.key, conDoc).editable)
      .map(f => f.key)
      .sort()
    // dietary_restrictions figura acá porque NO pasa por el editor genérico de
    // texto: son checkboxes con validación propia y el FormFiller lo pinta con
    // su propio componente. Editable sí, por otro camino.
    // 'emergency_contact' y 'dietary_restrictions' figuran acá porque NO pasan
    // por el editor genérico de texto: el primero son dos campos bajo una
    // etiqueta y el segundo son checkboxes, y el FormFiller los pinta con sus
    // propios componentes. Editables sí, por otro camino.
    expect(noEditables).toEqual([
      'age', 'cedula', 'dietary_restrictions', 'email',
      'emergency_contact', 'full_name', 'marital_status',
    ])
  })
})
